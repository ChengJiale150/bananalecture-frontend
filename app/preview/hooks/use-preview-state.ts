import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { PPTPlan, Slide, Dialogue } from '@/lib/chat-store';
import type { DialogueAgentUIMessage } from '@/agent/dialogue/agent';
import { 
  createClientId, 
  fetchChat, 
  saveChatToApi, 
  normalizeDialogues, 
  StoredPreviewPlan 
} from '../utils';

export function usePreviewState(projectIdFromUrl: string | null) {
  const [plan, setPlan] = useState<PPTPlan | null>(null);
  const [projectId, setProjectId] = useState<string>(projectIdFromUrl || '');
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [liveDialoguesBySlide, setLiveDialoguesBySlide] = useState<Record<string, Dialogue[]>>({});
  
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [generationQueue, setGenerationQueue] = useState<number[]>([]);
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0 });
  
  const processedOutputIdsRef = useRef<Set<string>>(new Set());

  // Reset liveDialogues when projectId changes (new project loaded)
  useEffect(() => {
    setLiveDialoguesBySlide({});
  }, [projectId]);

  const { status, sendMessage, messages, stop } = useChat<DialogueAgentUIMessage>({
    transport: new DefaultChatTransport({ api: '/api/dialogue' }),
    id: projectId || 'preview-dialogue',
  });

  // We strictly adhere to DB-First strategy.
  // SessionStorage is no longer used for persistence to avoid state drift and serialization overhead.
  const syncSessionStorage = useCallback((_nextProjectId: string, _nextPlan: PPTPlan) => {
    // No-op: Performance optimization.
    // We do not write to sessionStorage to avoid blocking the main thread with JSON.stringify on large objects.
    // All state is persisted to the database immediately.
  }, []);

  const upsertSlideDialogues = useCallback(
    (target: { slideId?: string; slideIndex?: number }, dialogues: Dialogue[]) => {
      setPlan(prev => {
        if (!prev?.slides?.length) return prev;
        const updatedSlides = prev.slides.map((slide, index) => {
          const matchById = target.slideId && slide.id === target.slideId;
          const matchByIndex = typeof target.slideIndex === 'number' && index === target.slideIndex;
          if (matchById || matchByIndex) {
            return { ...slide, dialogues };
          }
          return slide;
        });
        const nextPlan = { slides: updatedSlides };
        if (projectId) {
          syncSessionStorage(projectId, nextPlan);
        }
        return nextPlan;
      });
    },
    [projectId, syncSessionStorage],
  );

  // Load plan from storage or API
  useEffect(() => {
    const loadPlan = async () => {
      try {
        if (projectIdFromUrl) {
          setProjectId(projectIdFromUrl);
          // Always prefer server data first if ID is present
          const serverChat = await fetchChat(projectIdFromUrl);
          if (serverChat?.pptPlan?.slides?.length) {
            const serverPlan = { slides: serverChat.pptPlan.slides as Slide[] };
            setPlan(serverPlan);
            // Clear session storage to avoid confusion
            sessionStorage.removeItem('current_ppt_plan');
            return;
          }
        }

        // Fallback to session storage only if no server data found (e.g. new unsaved project)
        const storedPlan = sessionStorage.getItem('current_ppt_plan');
        const parsed = storedPlan ? (JSON.parse(storedPlan) as StoredPreviewPlan | PPTPlan) : null;

        if (parsed && Array.isArray((parsed as any).slides)) {
          const slides = (parsed as any).slides as Slide[];
          const initialPlan = { slides };
          const parsedProjectId = (parsed as StoredPreviewPlan).projectId;
          const nextProjectId = projectIdFromUrl || parsedProjectId || createClientId();
          
          if (!projectIdFromUrl) {
              setProjectId(nextProjectId);
          }

          // If we have a project ID, try to fetch from server again to be sure
          if (nextProjectId) {
             const serverChat = await fetchChat(nextProjectId);
             if (serverChat?.pptPlan?.slides?.length) {
               const serverPlan = { slides: serverChat.pptPlan.slides as Slide[] };
               setPlan(serverPlan);
               return;
             }
          }

          setPlan(initialPlan);

          if (!parsedProjectId && !projectIdFromUrl) {
            await saveChatToApi({
              id: nextProjectId,
              title: slides[0]?.title || 'New Project',
              messages: [],
              pptPlan: initialPlan,
            });
          }
        }
      } catch (e) {
        console.error('Failed to parse plan data from storage or server', e);
      } finally {
        setIsLoading(false);
      }
    };

    void loadPlan();
  }, [projectIdFromUrl, syncSessionStorage]);

  // Sync plan to storage when it changes
  useEffect(() => {
    if (!projectId || !plan) return;
    syncSessionStorage(projectId, plan);
  }, [projectId, plan, syncSessionStorage]);

  // Handle messages from AI
  useEffect(() => {
    // Check if we are currently generating for the current slide
    // If so, we should clear any existing dialogues to show the streaming content
    const _isGeneratingCurrentSlide = status === 'streaming' || status === 'submitted';
    
    for (const message of messages) {
      const parts = (message as any)?.parts;
      if (!Array.isArray(parts)) continue;

      for (const part of parts) {
        if (!part || typeof part !== 'object') continue;
        if ((part as any).type !== 'tool-create_dialogue_script') continue;

        const input =
          (part as any).input ||
          (part as any).args ||
          (part as any).toolInvocation?.input ||
          (part as any).toolInvocation?.args;
        const output = (part as any).output || (part as any).result || (part as any).toolInvocation?.output;
        const toolCallId =
          (part as any).toolCallId ||
          (part as any).toolInvocation?.toolCallId ||
          (part as any).toolInvocation?.toolCallID;

        if (Array.isArray(input?.dialogues)) {
          const partialDialogues = normalizeDialogues(input.dialogues);
          const partialSlideId =
            input?.slideId ||
            (typeof input?.slideIndex === 'number' ? plan?.slides[input.slideIndex]?.id : undefined);
          
          if (partialSlideId) {
             // If we are streaming updates for the current slide, ensure we overwrite any stale data
             setLiveDialoguesBySlide(prev => ({ ...prev, [partialSlideId]: partialDialogues }));
          }
        }

        if (!toolCallId || processedOutputIdsRef.current.has(toolCallId)) continue;
        if (!Array.isArray(output?.dialogues)) continue;

        processedOutputIdsRef.current.add(toolCallId);
        const finalDialogues = normalizeDialogues(output.dialogues);
        const outputSlideId =
          output?.slideId ||
          input?.slideId ||
          (typeof output?.slideIndex === 'number' ? plan?.slides[output.slideIndex]?.id : undefined) ||
          (typeof input?.slideIndex === 'number' ? plan?.slides[input.slideIndex]?.id : undefined);
        const outputSlideIndex =
          typeof output?.slideIndex === 'number'
            ? output.slideIndex
            : typeof input?.slideIndex === 'number'
              ? input.slideIndex
              : undefined;

        upsertSlideDialogues({ slideId: outputSlideId, slideIndex: outputSlideIndex }, finalDialogues);
        if (outputSlideId) {
          setLiveDialoguesBySlide(prev => ({ ...prev, [outputSlideId]: finalDialogues }));
        }
      }
    }
  }, [projectId, messages, plan?.slides, syncSessionStorage, upsertSlideDialogues, status]);

  const currentSlide = plan?.slides[currentSlideIndex];

  // Dynamically load dialogues for current slide
  useEffect(() => {
    if (!currentSlide || !currentSlide.id) return;
    // If we already have dialogues for this slide (either from live generation or previously loaded), skip fetching
    if (liveDialoguesBySlide[currentSlide.id] || (currentSlide.dialogues && currentSlide.dialogues.length > 0)) return;

    let mounted = true;
    const loadDialogues = async () => {
      try {
        const res = await fetch(`/api/dialogue/list?slideId=${currentSlide.id}`);
        if (res.ok) {
          const dialogues = await res.json();
          if (mounted && Array.isArray(dialogues) && dialogues.length > 0) {
            setPlan(prev => {
              if (!prev) return prev;
              const nextSlides = [...prev.slides];
              const slideIdx = nextSlides.findIndex(s => s.id === currentSlide.id);
              if (slideIdx !== -1) {
                // Merge loaded dialogues, but be careful not to overwrite if live generation happened in the meantime
                nextSlides[slideIdx] = { ...nextSlides[slideIdx], dialogues };
              }
              return { slides: nextSlides };
            });
          }
        }
      } catch (err) {
        console.error('Failed to fetch dialogues:', err);
      }
    };
    loadDialogues();
    return () => { mounted = false; };
  }, [currentSlide, liveDialoguesBySlide]);

  const displayDialogues = useMemo(() => {
    if (!currentSlide) return [];
    
    // Check if we have explicit "empty" state in liveDialogues (which means cleared)
    // We need to differentiate between "undefined" (not loaded) and "empty array" (cleared/generating)
    const live = liveDialoguesBySlide[currentSlide.id];
    
    if (Array.isArray(live)) {
       // If it is an array (even empty), it takes precedence over plan.dialogues
       return live;
    }
    
    if (Array.isArray(currentSlide.dialogues)) {
      return currentSlide.dialogues;
    }
    return [];
  }, [currentSlide, liveDialoguesBySlide]);

  const handleGenerateDialogues = useCallback(async () => {
    if (!projectId || !plan || !currentSlide) return;
    
    // 1. Clear backend data first and wait for completion
    try {
        await fetch('/api/dialogue/clear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slideId: currentSlide.id }),
        });
    } catch (e) {
        console.error("Failed to clear dialogues", e);
        // Continue anyway to try generation, but log error
    }

    // 2. Clear frontend cache (liveDialoguesBySlide)
    // We set it to empty array [] to indicate "cleared/loading" state, NOT undefined.
    // This forces displayDialogues to return [] instead of falling back to plan.dialogues (which might be stale during async update)
    setLiveDialoguesBySlide(prev => ({ ...prev, [currentSlide.id]: [] }));

    // 3. Update plan state to clear dialogues immediately
    setPlan(prev => {
        if (!prev) return prev;
        const nextSlides = [...prev.slides];
        const slideIdx = nextSlides.findIndex(s => s.id === currentSlide.id);
        if (slideIdx !== -1) {
            nextSlides[slideIdx] = { ...nextSlides[slideIdx], dialogues: [] };
        }
        return { slides: nextSlides };
    });
    
    // 4. Generate new content
    // We pass empty previousDialogues to ensure the agent generates from scratch
    sendMessage(
      { text: `请为第${currentSlideIndex + 1}页生成口播稿对话` },
      {
        body: {
          id: projectId,
          autoApprove: true,
          pptPlan: plan,
          targetSlideId: currentSlide.id,
          targetSlideIndex: currentSlideIndex,
          previousDialogues: [], 
        },
      },
    );
  }, [projectId, currentSlide, currentSlideIndex, plan, sendMessage]);

  const handleStopGeneration = useCallback(() => {
    setGenerationQueue([]);
    stop();
    setIsGeneratingAll(false);
  }, [stop]);

  // Queue-based batch generation effect
  useEffect(() => {
    if (!isGeneratingAll) return;

    if (generationQueue.length === 0) {
      if (status === 'ready') {
        setIsGeneratingAll(false);
        // Refresh page data after batch generation
        window.location.reload(); 
      }
      return;
    }

    if (status === 'ready' && projectId && plan?.slides) {
      const nextIndex = generationQueue[0];
      const nextQueue = generationQueue.slice(1);
      
      const processNext = async () => {
          // Update queue immediately to prevent double submission
          setGenerationQueue(nextQueue);
          
          // Update progress
          setGenerationProgress(prev => ({
            ...prev,
            current: prev.total - nextQueue.length
          }));

          const slide = plan.slides[nextIndex];
          if (!slide) return;

          // 1. Clear backend data
          await fetch('/api/dialogue/clear', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ slideId: slide.id }),
          });

          // 2. Clear frontend cache
          setLiveDialoguesBySlide(prev => {
              const next = { ...prev };
              delete next[slide.id];
              return next;
          });

          setPlan(prev => {
              if (!prev) return prev;
              const nextSlides = [...prev.slides];
              const slideIdx = nextSlides.findIndex(s => s.id === slide.id);
              if (slideIdx !== -1) {
                  nextSlides[slideIdx] = { ...nextSlides[slideIdx], dialogues: [] };
              }
              return { slides: nextSlides };
          });
          
          // 3. Generate new content
          sendMessage(
            { text: `请为第${nextIndex + 1}页生成口播稿对话` },
            {
              body: {
                id: projectId,
                autoApprove: true,
                pptPlan: plan,
                targetSlideId: slide.id,
                targetSlideIndex: nextIndex,
                previousDialogues: [],
              },
            },
          );
      };
      processNext();
    }
  }, [isGeneratingAll, generationQueue, status, projectId, plan, sendMessage]);

  const handleGenerateAllDialogues = useCallback(() => {
    if (!projectId || !plan?.slides.length) return;
    
    setIsGeneratingAll(true);
    setGenerationProgress({ current: 0, total: plan.slides.length });
    
    // Fill queue with all indices
    const indices = Array.from({ length: plan.slides.length }, (_, i) => i);
    setGenerationQueue(indices);
  }, [projectId, plan]);

  const handleForceRefresh = useCallback(() => {
    // Clear session storage
    sessionStorage.removeItem('current_ppt_plan');
    // Reload page to fetch fresh data from DB
    window.location.reload();
  }, []);

  return {
    plan,
    projectId,
    currentSlideIndex,
    setCurrentSlideIndex,
    isLoading,
    isGeneratingAll,
    generationProgress,
    status,
    currentSlide,
    displayDialogues,
    handleGenerateDialogues,
    handleGenerateAllDialogues,
    handleStopGeneration,
    handleForceRefresh
  };
}
