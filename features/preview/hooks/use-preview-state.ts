import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type {
  Dialogue,
  GenerationSessionMode,
  GenerationSessionState,
  GenerationStage,
  PPTPlan,
  TaskProgress,
} from '@/features/projects/types';
import {
  addDialogue,
  batchGenerateAudio,
  batchGenerateDialogues,
  batchGenerateImages,
  cancelTask,
  deleteDialogue,
  downloadVideoFile,
  generateDialogues,
  generateSlideAudio,
  generateSlideImage,
  generateVideo,
  getProject,
  getSlideAudioUrl,
  getSlideImageUrl,
  getTask,
  listDialogues,
  reorderDialogues,
  updateDialogue,
} from '@/features/projects/api';
import { getPageParamFromSlideIndex, getSlideIndexFromPageParam } from '@/features/projects/utils';
import {
  advanceGenerationSession,
  attachTaskToGenerationStage,
  clearGenerationSession,
  createGenerationSession,
  finalizeGenerationSession,
  getCurrentGenerationStageState,
  getGenerationOverallProgress,
  getGenerationStageLabel,
  getNextGenerationStage,
  getTaskProgressPercent,
  isGenerationSessionActive,
  loadGenerationSession,
  markGenerationStageCompleted,
  persistGenerationSession,
} from '@/features/preview/utils/generation-session';
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

function createErroredSession(
  projectId: string,
  mode: GenerationSessionMode,
  stage: GenerationStage,
  message: string,
) {
  const base = createGenerationSession(projectId, mode, stage, null);

  return {
    ...base,
    status: 'failed' as const,
    errorMessage: message,
    stages: base.stages.map((item) =>
      item.stage === stage ? { ...item, status: 'failed' as const, progress: 0 } : item,
    ),
    updatedAt: Date.now(),
  };
}

export function usePreviewState(projectIdFromUrl: string | null, pageFromUrl: string | null) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [plan, setPlan] = useState<PPTPlan | null>(null);
  const [projectId, setProjectId] = useState(projectIdFromUrl || '');
  const [projectVideoPath, setProjectVideoPath] = useState<string | undefined>();
  const [currentSlideIndex, setCurrentSlideIndexState] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingDialogues, setIsSavingDialogues] = useState(false);
  const [generationSession, setGenerationSession] = useState<GenerationSessionState | null>(null);
  const generationSessionRef = useRef<GenerationSessionState | null>(null);

  useEffect(() => {
    generationSessionRef.current = generationSession;
  }, [generationSession]);

  const setCurrentSlideIndex = useCallback(
    (nextIndex: number) => {
      const nextPage = getPageParamFromSlideIndex(nextIndex);
      const params = new URLSearchParams(searchParams.toString());
      params.set('page', String(nextPage));
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const commitGenerationSession = useCallback(
    (nextSession: GenerationSessionState | null) => {
      generationSessionRef.current = nextSession;
      setGenerationSession(nextSession);

      const storageProjectId = nextSession?.projectId ?? projectId;
      if (!storageProjectId) {
        return;
      }

      if (nextSession) {
        persistGenerationSession(nextSession);
      } else {
        clearGenerationSession(storageProjectId);
      }
    },
    [projectId],
  );

  const refreshProject = useCallback(async () => {
    if (!projectId) return null;
    const project = await getProject(projectId);
    setPlan(project.pptPlan ?? null);
    setProjectVideoPath(project.videoPath ?? undefined);
    return project;
  }, [projectId]);

  const startStageTask = useCallback(
    async (
      stage: GenerationStage,
      mode: GenerationSessionMode,
      baseSession?: GenerationSessionState | null,
    ) => {
      if (!projectId) return;

      const startTask = {
        images: batchGenerateImages,
        dialogues: batchGenerateDialogues,
        audio: batchGenerateAudio,
        video: generateVideo,
      }[stage];

      try {
        const taskId = await startTask(projectId);
        const task = await getTask(taskId);
        const nextSession = baseSession
          ? attachTaskToGenerationStage(
              {
                ...baseSession,
                mode,
                status: 'running',
                currentStage: stage,
                activeTask: null,
                errorMessage: null,
              },
              stage,
              task,
            )
          : createGenerationSession(projectId, mode, stage, task);

        commitGenerationSession(nextSession);
      } catch (error) {
        const message = error instanceof Error ? error.message : `启动${getGenerationStageLabel(stage)}任务失败`;
        commitGenerationSession(createErroredSession(projectId, mode, stage, message));
      }
    },
    [commitGenerationSession, projectId],
  );

  useEffect(() => {
    const loadPlan = async () => {
      try {
        if (!projectIdFromUrl) {
          setProjectId('');
          setPlan(null);
          setProjectVideoPath(undefined);
          commitGenerationSession(null);
          return;
        }

        setProjectId(projectIdFromUrl);
        const project = await getProject(projectIdFromUrl);
        setPlan(project.pptPlan ?? null);
        setProjectVideoPath(project.videoPath ?? undefined);
        setCurrentSlideIndexState(getSlideIndexFromPageParam(pageFromUrl, project.pptPlan?.slides.length ?? 0));
        commitGenerationSession(loadGenerationSession(projectIdFromUrl));
      } catch (error) {
        console.error('Failed to load preview plan:', error);
        setPlan(null);
        setProjectVideoPath(undefined);
      } finally {
        setIsLoading(false);
      }
    };

    void loadPlan();
  }, [commitGenerationSession, pageFromUrl, projectIdFromUrl]);

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
    const restoredSession = generationSessionRef.current;
    if (!restoredSession || restoredSession.status !== 'running' || !projectId) {
      return;
    }

    const currentStage = restoredSession.currentStage;
    const currentStageState = getCurrentGenerationStageState(restoredSession);
    const activeTaskId = restoredSession.activeTask?.id ?? currentStageState?.taskId;

    if (activeTaskId || !currentStage || restoredSession.mode !== 'pipeline') {
      return;
    }

    if (currentStageState?.status === 'completed') {
      const nextStage = getNextGenerationStage(currentStage);
      if (nextStage) {
        void startStageTask(nextStage, restoredSession.mode, restoredSession);
      }
    }
  }, [projectId, startStageTask]);

  useEffect(() => {
    const activeSession = generationSession;
    if (!activeSession || activeSession.status !== 'running') {
      return;
    }

    const taskId = activeSession.activeTask?.id ?? getCurrentGenerationStageState(activeSession)?.taskId;
    if (!taskId) {
      return;
    }

    let cancelled = false;
    let intervalId = 0;

    const pollTask = async () => {
      try {
        const nextTask = await getTask(taskId);
        if (cancelled) return;

        const currentSession = generationSessionRef.current;
        if (!currentSession) {
          return;
        }

        const updatedSession = updateAndPersistCurrentTask(currentSession, nextTask);

        if (nextTask.status === 'pending' || nextTask.status === 'running') {
          return;
        }

        window.clearInterval(intervalId);
        await refreshProject();

        if (nextTask.status === 'completed') {
          await completeGenerationSession(updatedSession, nextTask);
          return;
        }

        commitGenerationSession(
          finalizeGenerationSession(
            updatedSession,
            nextTask.status === 'cancelled' ? 'cancelled' : 'failed',
            nextTask,
          ),
        );
      } catch (error) {
        console.error('Failed to poll task:', error);
        window.clearInterval(intervalId);
      }
    };

    const updateAndPersistCurrentTask = (
      currentSession: GenerationSessionState,
      nextTask: TaskProgress,
    ) => {
      const nextSession = attachTaskToGenerationStage(
        {
          ...currentSession,
          activeTask: nextTask,
        },
        currentSession.currentStage ?? activeSession.currentStage ?? 'images',
        nextTask,
      );
      commitGenerationSession(nextSession);
      return nextSession;
    };

    const completeGenerationSession = async (
      currentSession: GenerationSessionState,
      nextTask: TaskProgress,
    ) => {
      const activeStage = currentSession.currentStage;
      if (!activeStage) {
        commitGenerationSession(finalizeGenerationSession(currentSession, 'completed', nextTask));
        return;
      }

      const completedSession = markGenerationStageCompleted(currentSession, activeStage);

      if (completedSession.mode === 'pipeline') {
        const nextStage = getNextGenerationStage(activeStage);
        if (nextStage) {
          const advancedSession = advanceGenerationSession(completedSession, nextStage);
          commitGenerationSession(advancedSession);
          await startStageTask(nextStage, 'pipeline', advancedSession);
          return;
        }
      }

      commitGenerationSession(finalizeGenerationSession(completedSession, 'completed', nextTask));
    };

    void pollTask();
    intervalId = window.setInterval(() => {
      void pollTask();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [commitGenerationSession, generationSession, refreshProject, startStageTask]);

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
  }, [currentSlide?.dialogues, currentSlide?.id, projectId]);

  const displayDialogues = useMemo(() => currentSlide?.dialogues ?? [], [currentSlide]);

  const replaceSlideDialoguesInState = useCallback((slideId: string, dialogues: Dialogue[]) => {
    setPlan((prev) => {
      if (!prev) return prev;
      return {
        slides: prev.slides.map((slide) => (slide.id === slideId ? { ...slide, dialogues } : slide)),
      };
    });
  }, []);

  const handleGenerateDialogues = useCallback(async () => {
    if (!projectId || !currentSlide?.id) return;
    try {
      const dialogues = normalizeDialogues(await generateDialogues(projectId, currentSlide.id));
      replaceSlideDialoguesInState(currentSlide.id, dialogues);
      await refreshProject();
    } catch (error) {
      console.error('Failed to generate dialogues:', error);
    }
  }, [currentSlide?.id, projectId, refreshProject, replaceSlideDialoguesInState]);

  const handleStartStageGeneration = useCallback(
    async (stage: GenerationStage) => {
      if (!projectId || isGenerationSessionActive(generationSessionRef.current)) {
        return;
      }

      await startStageTask(stage, 'single-stage');
    },
    [projectId, startStageTask],
  );

  const handleGenerateAll = useCallback(async () => {
    if (!projectId || isGenerationSessionActive(generationSessionRef.current)) {
      return;
    }

    await startStageTask('images', 'pipeline');
  }, [projectId, startStageTask]);

  const handleStopGeneration = useCallback(async () => {
    const activeTaskId = generationSessionRef.current?.activeTask?.id;
    if (!activeTaskId) return;

    try {
      const cancelledTask = await cancelTask(activeTaskId);
      const currentSession = generationSessionRef.current;
      if (!currentSession) return;
      commitGenerationSession(finalizeGenerationSession(currentSession, 'cancelled', cancelledTask));
    } catch (error) {
      console.error('Failed to cancel task:', error);
    }
  }, [commitGenerationSession]);

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
      await refreshProject();
    } catch (error) {
      console.error('Failed to generate image:', error);
    }
  }, [currentSlide?.id, projectId, refreshProject]);

  const handleGenerateAudio = useCallback(async () => {
    if (!projectId || !currentSlide?.id) return;
    try {
      await generateSlideAudio(projectId, currentSlide.id);
      await refreshProject();
    } catch (error) {
      console.error('Failed to generate audio:', error);
    }
  }, [currentSlide?.id, projectId, refreshProject]);

  const handleOpenSlideAudio = useCallback(() => {
    if (!projectId || !currentSlide?.id) return;
    window.open(getSlideAudioUrl(projectId, currentSlide.id), '_blank', 'noopener,noreferrer');
  }, [currentSlide?.id, projectId]);

  const handleOpenSlideImage = useCallback(() => {
    if (!projectId || !currentSlide?.id) return;
    window.open(getSlideImageUrl(projectId, currentSlide.id), '_blank', 'noopener,noreferrer');
  }, [currentSlide?.id, projectId]);

  const handleDownloadVideo = useCallback(async () => {
    if (!projectId) return;

    try {
      const { blob, filename } = await downloadVideoFile(projectId);
      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error('Failed to download video:', error);
    }
  }, [projectId]);

  const currentGenerationStage = getCurrentGenerationStageState(generationSession);
  const overallGenerationProgress = useMemo(
    () => getGenerationOverallProgress(generationSession),
    [generationSession],
  );
  const currentStageTaskProgress = useMemo(() => {
    if (!generationSession?.activeTask) {
      return currentGenerationStage?.progress ?? 0;
    }

    return generationSession.activeTask.status === 'completed'
      ? 100
      : getTaskProgressPercent(generationSession.activeTask);
  }, [currentGenerationStage?.progress, generationSession?.activeTask]);

  return {
    plan,
    projectId,
    currentSlideIndex,
    setCurrentSlideIndex,
    isLoading,
    isGeneratingAll: isGenerationSessionActive(generationSession),
    isSavingDialogues,
    generationSession,
    overallGenerationProgress,
    currentStageTaskProgress,
    currentSlide,
    displayDialogues,
    projectVideoPath,
    handleGenerateDialogues,
    handleGenerateAll,
    handleStartStageGeneration,
    handleStopGeneration,
    handleForceRefresh: refreshProject,
    handleSaveManualDialogues,
    handleGenerateImage,
    handleGenerateAudio,
    handleOpenSlideAudio,
    handleOpenSlideImage,
    handleDownloadVideo,
  };
}
