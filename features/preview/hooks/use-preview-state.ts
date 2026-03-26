import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Dialogue, PPTPlan, TaskProgress } from '@/features/projects/types';
import {
  addDialogue,
  batchGenerateAudio,
  batchGenerateDialogues,
  batchGenerateImages,
  cancelTask,
  deleteDialogue,
  generateDialogues,
  generateSlideAudio,
  generateSlideImage,
  generateVideo,
  getProject,
  getSlideAudioUrl,
  getSlideImageUrl,
  getTask,
  getVideoUrl,
  listDialogues,
  reorderDialogues,
  updateDialogue,
} from '@/features/projects/api';
import { getPageParamFromSlideIndex, getSlideIndexFromPageParam } from '@/features/projects/utils';
import { normalizeDialogues } from '../utils';

const POLL_INTERVAL_MS = 1500;

function dialoguesDiffer(left: Dialogue, right: Dialogue) {
  return (
    left.role !== right.role ||
    left.content !== right.content ||
    (left.emotion ?? '无明显情感') !== (right.emotion ?? '无明显情感') ||
    (left.speed ?? '中速') !== (right.speed ?? '中速')
  );
}

export function usePreviewState(projectIdFromUrl: string | null, pageFromUrl: string | null) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [plan, setPlan] = useState<PPTPlan | null>(null);
  const [projectId, setProjectId] = useState<string>(projectIdFromUrl || '');
  const [currentSlideIndex, setCurrentSlideIndexState] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingDialogues, setIsSavingDialogues] = useState(false);
  const [activeTask, setActiveTask] = useState<TaskProgress | null>(null);

  const setCurrentSlideIndex = useCallback(
    (nextIndex: number) => {
      const nextPage = getPageParamFromSlideIndex(nextIndex);
      const params = new URLSearchParams(searchParams.toString());
      params.set('page', String(nextPage));
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const refreshPlan = useCallback(async () => {
    if (!projectId) return;
    const project = await getProject(projectId);
    setPlan(project.pptPlan ?? null);
  }, [projectId]);

  useEffect(() => {
    const loadPlan = async () => {
      try {
        if (!projectIdFromUrl) {
          setPlan(null);
          return;
        }
        setProjectId(projectIdFromUrl);
        const project = await getProject(projectIdFromUrl);
        setPlan(project.pptPlan ?? null);
        setCurrentSlideIndexState(getSlideIndexFromPageParam(pageFromUrl, project.pptPlan?.slides.length ?? 0));
      } catch (error) {
        console.error('Failed to load preview plan:', error);
        setPlan(null);
      } finally {
        setIsLoading(false);
      }
    };

    void loadPlan();
  }, [pageFromUrl, projectIdFromUrl]);

  useEffect(() => {
    if (!plan) return;
    setCurrentSlideIndexState(getSlideIndexFromPageParam(pageFromUrl, plan.slides.length));
  }, [pageFromUrl, plan]);

  useEffect(() => {
    if (!plan || plan.slides.length === 0) return;

    const nextIndex = getSlideIndexFromPageParam(pageFromUrl, plan.slides.length);
    const nextPage = getPageParamFromSlideIndex(nextIndex);
    const currentPage = searchParams.get('page');

    if (currentPage === String(nextPage)) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(nextPage));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pageFromUrl, pathname, plan, router, searchParams]);

  useEffect(() => {
    if (!activeTask || !['pending', 'running'].includes(activeTask.status)) return;

    let cancelled = false;
    const intervalId = window.setInterval(async () => {
      try {
        const nextTask = await getTask(activeTask.id);
        if (cancelled) return;
        setActiveTask(nextTask);

        if (!['pending', 'running'].includes(nextTask.status)) {
          window.clearInterval(intervalId);
          await refreshPlan();
        }
      } catch (error) {
        console.error('Failed to poll task:', error);
        window.clearInterval(intervalId);
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeTask, refreshPlan]);

  const currentSlide = plan?.slides[currentSlideIndex];

  useEffect(() => {
    if (!currentSlide?.id || Array.isArray(currentSlide.dialogues)) return;

    let cancelled = false;
    const loadDialogues = async () => {
      try {
        const dialogues = await listDialogues(projectId, currentSlide.id);
        if (cancelled) return;
        setPlan((prev) => {
          if (!prev) return prev;
          return {
            slides: prev.slides.map((slide) =>
              slide.id === currentSlide.id ? { ...slide, dialogues } : slide,
            ),
          };
        });
      } catch (error) {
        console.error('Failed to fetch dialogues:', error);
      }
    };

    void loadDialogues();
    return () => {
      cancelled = true;
    };
  }, [currentSlide?.id, currentSlide?.dialogues, projectId]);

  const displayDialogues = useMemo(() => {
    if (!currentSlide?.dialogues) return [];
    return currentSlide.dialogues;
  }, [currentSlide]);

  const replaceSlideDialoguesInState = useCallback((slideId: string, dialogues: Dialogue[]) => {
    setPlan((prev) => {
      if (!prev) return prev;
      return {
        slides: prev.slides.map((slide) => (slide.id === slideId ? { ...slide, dialogues } : slide)),
      };
    });
  }, []);

  const runTaskAction = useCallback(async (startTask: () => Promise<string>) => {
    const taskId = await startTask();
    const task = await getTask(taskId);
    setActiveTask(task);
  }, []);

  const handleGenerateDialogues = useCallback(async () => {
    if (!projectId || !currentSlide?.id) return;
    try {
      const dialogues = normalizeDialogues(await generateDialogues(projectId, currentSlide.id));
      replaceSlideDialoguesInState(currentSlide.id, dialogues);
      await refreshPlan();
    } catch (error) {
      console.error('Failed to generate dialogues:', error);
    }
  }, [currentSlide?.id, projectId, refreshPlan, replaceSlideDialoguesInState]);

  const handleGenerateAllDialogues = useCallback(async () => {
    if (!projectId) return;
    await runTaskAction(() => batchGenerateDialogues(projectId));
  }, [projectId, runTaskAction]);

  const handleGenerateAllImages = useCallback(async () => {
    if (!projectId) return;
    await runTaskAction(() => batchGenerateImages(projectId));
  }, [projectId, runTaskAction]);

  const handleGenerateAllAudio = useCallback(async () => {
    if (!projectId) return;
    await runTaskAction(() => batchGenerateAudio(projectId));
  }, [projectId, runTaskAction]);

  const handleGenerateVideo = useCallback(async () => {
    if (!projectId) return;
    await runTaskAction(() => generateVideo(projectId));
  }, [projectId, runTaskAction]);

  const handleStopGeneration = useCallback(async () => {
    if (!activeTask) return;
    try {
      const cancelledTask = await cancelTask(activeTask.id);
      setActiveTask(cancelledTask);
    } catch (error) {
      console.error('Failed to cancel task:', error);
    }
  }, [activeTask]);

  const handleSaveManualDialogues = useCallback(
    async (dialogues: Dialogue[]) => {
      if (!projectId || !currentSlide?.id) return false;
      setIsSavingDialogues(true);

      try {
        const existingDialogues = currentSlide.dialogues ?? [];
        const existingById = new Map(existingDialogues.map((dialogue) => [dialogue.id, dialogue]));
        const nextIds = new Set(dialogues.map((dialogue) => dialogue.id));

        for (const existing of existingDialogues) {
          if (!nextIds.has(existing.id)) {
            await deleteDialogue(projectId, currentSlide.id, existing.id);
          }
        }

        const finalDialogues: Dialogue[] = [];

        for (const dialogue of dialogues) {
          const existing = existingById.get(dialogue.id);
          if (!existing) {
            finalDialogues.push(await addDialogue(projectId, currentSlide.id, dialogue));
            continue;
          }

          if (dialoguesDiffer(existing, dialogue)) {
            finalDialogues.push(await updateDialogue(projectId, currentSlide.id, dialogue));
          } else {
            finalDialogues.push(dialogue);
          }
        }

        await reorderDialogues(
          projectId,
          currentSlide.id,
          finalDialogues.map((dialogue) => dialogue.id),
        );

        const latestDialogues = normalizeDialogues(await listDialogues(projectId, currentSlide.id));
        replaceSlideDialoguesInState(currentSlide.id, latestDialogues);
        return true;
      } catch (error) {
        console.error('Failed to save manual dialogues:', error);
        return false;
      } finally {
        setIsSavingDialogues(false);
      }
    },
    [currentSlide, projectId, replaceSlideDialoguesInState],
  );

  const handleGenerateImage = useCallback(async () => {
    if (!projectId || !currentSlide?.id) return;
    try {
      await generateSlideImage(projectId, currentSlide.id);
      await refreshPlan();
    } catch (error) {
      console.error('Failed to generate image:', error);
    }
  }, [currentSlide?.id, projectId, refreshPlan]);

  const handleGenerateAudio = useCallback(async () => {
    if (!projectId || !currentSlide?.id) return;
    try {
      await generateSlideAudio(projectId, currentSlide.id);
      await refreshPlan();
    } catch (error) {
      console.error('Failed to generate audio:', error);
    }
  }, [currentSlide?.id, projectId, refreshPlan]);

  const handleOpenSlideAudio = useCallback(() => {
    if (!projectId || !currentSlide?.id) return;
    window.open(getSlideAudioUrl(projectId, currentSlide.id), '_blank', 'noopener,noreferrer');
  }, [currentSlide?.id, projectId]);

  const handleOpenSlideImage = useCallback(() => {
    if (!projectId || !currentSlide?.id) return;
    window.open(getSlideImageUrl(projectId, currentSlide.id), '_blank', 'noopener,noreferrer');
  }, [currentSlide?.id, projectId]);

  const handleOpenVideo = useCallback(() => {
    if (!projectId) return;
    window.open(getVideoUrl(projectId), '_blank', 'noopener,noreferrer');
  }, [projectId]);

  const generationProgress = useMemo(() => {
    if (!activeTask || activeTask.totalSteps <= 0) {
      return { current: 0, total: 0, failed: activeTask?.status === 'failed' ? 1 : 0 };
    }

    return {
      current: activeTask.currentStep,
      total: activeTask.totalSteps,
      failed: activeTask.status === 'failed' ? 1 : 0,
    };
  }, [activeTask]);

  return {
    plan,
    projectId,
    currentSlideIndex,
    setCurrentSlideIndex,
    isLoading,
    isGeneratingAll: Boolean(activeTask && ['pending', 'running'].includes(activeTask.status)),
    isSavingDialogues,
    generationProgress,
    activeTask,
    currentSlide,
    displayDialogues,
    handleGenerateDialogues,
    handleGenerateAllDialogues,
    handleGenerateAllImages,
    handleGenerateAllAudio,
    handleGenerateVideo,
    handleStopGeneration,
    handleForceRefresh: refreshPlan,
    handleSaveManualDialogues,
    handleGenerateImage,
    handleGenerateAudio,
    handleOpenSlideAudio,
    handleOpenSlideImage,
    handleOpenVideo,
  };
}
