import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { PPTPlan, Slide, Dialogue } from '@/lib/chat-store';
import type { DialogueAgentUIMessage } from '@/agent/dialogue/agent';
import { fetchChat, normalizeDialogues } from '../utils';

const GENERATION_TIMEOUT_MS = 120000;

export function usePreviewState(projectIdFromUrl: string | null) {
  const [plan, setPlan] = useState<PPTPlan | null>(null);
  const [projectId, setProjectId] = useState<string>(projectIdFromUrl || '');
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [liveDialoguesBySlide, setLiveDialoguesBySlide] = useState<Record<string, Dialogue[]>>({});
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [isSavingDialogues, setIsSavingDialogues] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0, failed: 0 });

  const processedOutputIdsRef = useRef<Set<string>>(new Set());
  const pendingGenerationRef = useRef<Map<string, (success: boolean) => void>>(new Map());
  const planRef = useRef<PPTPlan | null>(null);
  const runIdRef = useRef(0);

  const { status, sendMessage, messages, stop } = useChat<DialogueAgentUIMessage>({
    transport: new DefaultChatTransport({ api: '/api/dialogue' }),
    id: projectId || 'preview-dialogue',
  });

  useEffect(() => {
    planRef.current = plan;
  }, [plan]);

  useEffect(() => {
    setLiveDialoguesBySlide({});
  }, [projectId]);

  const upsertSlideDialogues = useCallback(
    (target: { slideId?: string; slideIndex?: number }, dialogues: Dialogue[]) => {
      setPlan((prev) => {
        if (!prev?.slides?.length) return prev;
        const updatedSlides = prev.slides.map((slide, index) => {
          const matchById = target.slideId && slide.id === target.slideId;
          const matchByIndex = typeof target.slideIndex === 'number' && index === target.slideIndex;
          if (matchById || matchByIndex) {
            return { ...slide, dialogues };
          }
          return slide;
        });
        return { slides: updatedSlides };
      });
    },
    [],
  );

  const refreshPlan = useCallback(async () => {
    if (!projectId) return;
    const serverChat = await fetchChat(projectId);
    if (serverChat?.pptPlan?.slides?.length) {
      setPlan({ slides: serverChat.pptPlan.slides as Slide[] });
      return;
    }
    setPlan(null);
  }, [projectId]);

  useEffect(() => {
    const loadPlan = async () => {
      try {
        if (!projectIdFromUrl) {
          setPlan(null);
          return;
        }
        setProjectId(projectIdFromUrl);
        const serverChat = await fetchChat(projectIdFromUrl);
        if (serverChat?.pptPlan?.slides?.length) {
          setPlan({ slides: serverChat.pptPlan.slides as Slide[] });
        } else {
          setPlan(null);
        }
      } catch (error) {
        console.error('Failed to load preview plan:', error);
      } finally {
        setIsLoading(false);
      }
    };
    void loadPlan();
  }, [projectIdFromUrl]);

  useEffect(() => {
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
            (typeof input?.slideIndex === 'number' ? planRef.current?.slides[input.slideIndex]?.id : undefined);
          if (partialSlideId) {
            setLiveDialoguesBySlide((prev) => ({ ...prev, [partialSlideId]: partialDialogues }));
          }
        }

        if (!toolCallId || processedOutputIdsRef.current.has(toolCallId)) continue;
        if (!Array.isArray(output?.dialogues)) continue;

        processedOutputIdsRef.current.add(toolCallId);
        const finalDialogues = normalizeDialogues(output.dialogues);
        const outputSlideId =
          output?.slideId ||
          input?.slideId ||
          (typeof output?.slideIndex === 'number' ? planRef.current?.slides[output.slideIndex]?.id : undefined) ||
          (typeof input?.slideIndex === 'number' ? planRef.current?.slides[input.slideIndex]?.id : undefined);
        const outputSlideIndex =
          typeof output?.slideIndex === 'number'
            ? output.slideIndex
            : typeof input?.slideIndex === 'number'
              ? input.slideIndex
              : undefined;

        upsertSlideDialogues({ slideId: outputSlideId, slideIndex: outputSlideIndex }, finalDialogues);

        if (outputSlideId) {
          setLiveDialoguesBySlide((prev) => ({ ...prev, [outputSlideId]: finalDialogues }));
          const pendingResolver = pendingGenerationRef.current.get(outputSlideId);
          if (pendingResolver) {
            const success = output?.persisted !== false;
            pendingResolver(success);
            pendingGenerationRef.current.delete(outputSlideId);
          }
        }
      }
    }
  }, [messages, upsertSlideDialogues]);

  const currentSlide = plan?.slides[currentSlideIndex];

  useEffect(() => {
    if (!currentSlide?.id) return;
    if (liveDialoguesBySlide[currentSlide.id] || (currentSlide.dialogues && currentSlide.dialogues.length > 0)) return;

    let mounted = true;
    const loadDialogues = async () => {
      try {
        const res = await fetch(`/api/dialogue/list?slideId=${currentSlide.id}`);
        if (!res.ok) return;
        const dialogues = await res.json();
        if (!mounted || !Array.isArray(dialogues) || dialogues.length === 0) return;
        setPlan((prev) => {
          if (!prev) return prev;
          const nextSlides = [...prev.slides];
          const slideIdx = nextSlides.findIndex((s) => s.id === currentSlide.id);
          if (slideIdx !== -1) {
            nextSlides[slideIdx] = { ...nextSlides[slideIdx], dialogues };
          }
          return { slides: nextSlides };
        });
      } catch (error) {
        console.error('Failed to fetch dialogues:', error);
      }
    };
    void loadDialogues();
    return () => {
      mounted = false;
    };
  }, [currentSlide, liveDialoguesBySlide]);

  const displayDialogues = useMemo(() => {
    if (!currentSlide) return [];
    const live = liveDialoguesBySlide[currentSlide.id];
    if (Array.isArray(live)) return live;
    if (Array.isArray(currentSlide.dialogues)) return currentSlide.dialogues;
    return [];
  }, [currentSlide, liveDialoguesBySlide]);

  const clearLocalDialogues = useCallback((slideId: string) => {
    setLiveDialoguesBySlide((prev) => ({ ...prev, [slideId]: [] }));
    setPlan((prev) => {
      if (!prev) return prev;
      const nextSlides = [...prev.slides];
      const slideIdx = nextSlides.findIndex((s) => s.id === slideId);
      if (slideIdx !== -1) {
        nextSlides[slideIdx] = { ...nextSlides[slideIdx], dialogues: [] };
      }
      return { slides: nextSlides };
    });
  }, []);

  const generateForSlide = useCallback(
    async (slide: Slide, slideIndex: number, snapshotPlan: PPTPlan) => {
      try {
        await fetch('/api/dialogue/clear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slideId: slide.id }),
        });
      } catch (error) {
        console.error('Failed to clear dialogues:', error);
      }

      clearLocalDialogues(slide.id);

      const completed = await new Promise<boolean>((resolve) => {
        const timeoutId = setTimeout(() => {
          pendingGenerationRef.current.delete(slide.id);
          resolve(false);
        }, GENERATION_TIMEOUT_MS);

        pendingGenerationRef.current.set(slide.id, (success) => {
          clearTimeout(timeoutId);
          resolve(success);
        });

        sendMessage(
          { text: `请为第${slideIndex + 1}页生成口播稿对话` },
          {
            body: {
              id: projectId,
              autoApprove: true,
              pptPlan: snapshotPlan,
              targetSlideId: slide.id,
              targetSlideIndex: slideIndex,
              previousDialogues: [],
            },
          },
        );
      });

      return completed;
    },
    [clearLocalDialogues, projectId, sendMessage],
  );

  const handleGenerateDialogues = useCallback(async () => {
    if (!projectId || !planRef.current || !currentSlide) return;
    const snapshotPlan = planRef.current;
    await generateForSlide(currentSlide, currentSlideIndex, snapshotPlan);
  }, [currentSlide, currentSlideIndex, generateForSlide, projectId]);

  const handleStopGeneration = useCallback(() => {
    runIdRef.current += 1;
    for (const resolver of pendingGenerationRef.current.values()) {
      resolver(false);
    }
    pendingGenerationRef.current.clear();
    stop();
    setIsGeneratingAll(false);
  }, [stop]);

  const handleGenerateAllDialogues = useCallback(async () => {
    if (!projectId || !planRef.current?.slides.length) return;
    const runId = Date.now();
    runIdRef.current = runId;
    setIsGeneratingAll(true);
    setGenerationProgress({ current: 0, total: planRef.current.slides.length, failed: 0 });

    let failed = 0;
    const total = planRef.current.slides.length;

    for (let index = 0; index < total; index += 1) {
      if (runIdRef.current !== runId) break;
      const snapshotPlan = planRef.current;
      const slide = snapshotPlan?.slides[index];
      if (!snapshotPlan || !slide) {
        failed += 1;
        setGenerationProgress({ current: index + 1, total, failed });
        continue;
      }
      const success = await generateForSlide(slide, index, snapshotPlan);
      if (!success) failed += 1;
      setGenerationProgress({ current: index + 1, total, failed });
    }

    if (runIdRef.current === runId) {
      setIsGeneratingAll(false);
      await refreshPlan();
    }
  }, [generateForSlide, projectId, refreshPlan]);

  const handleSaveManualDialogues = useCallback(
    async (dialogues: Dialogue[]) => {
      if (!projectId || !currentSlide?.id) return false;
      setIsSavingDialogues(true);
      try {
        const res = await fetch('/api/dialogue', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            slideId: currentSlide.id,
            dialogues,
          }),
        });
        if (!res.ok) return false;
        const result = await res.json();
        if (!Array.isArray(result?.dialogues)) return false;
        const normalized = normalizeDialogues(result.dialogues);
        setLiveDialoguesBySlide((prev) => ({ ...prev, [currentSlide.id]: normalized }));
        upsertSlideDialogues({ slideId: currentSlide.id }, normalized);
        return true;
      } catch (error) {
        console.error('Failed to save manual dialogues:', error);
        return false;
      } finally {
        setIsSavingDialogues(false);
      }
    },
    [currentSlide?.id, projectId, upsertSlideDialogues],
  );

  const handleForceRefresh = useCallback(() => {
    void refreshPlan();
  }, [refreshPlan]);

  return {
    plan,
    projectId,
    currentSlideIndex,
    setCurrentSlideIndex,
    isLoading,
    isGeneratingAll,
    isSavingDialogues,
    generationProgress,
    status,
    currentSlide,
    displayDialogues,
    handleGenerateDialogues,
    handleGenerateAllDialogues,
    handleStopGeneration,
    handleForceRefresh,
    handleSaveManualDialogues,
  };
}
