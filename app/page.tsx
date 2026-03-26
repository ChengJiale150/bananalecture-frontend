'use client';

import { useChat } from '@ai-sdk/react';
import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { Loader2, BrainCircuit, ChevronDown, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useRouter } from 'next/navigation';
import ChatInput from '@/component/chat-input';
import Sidebar from '@/component/sidebar';
import ToolView from '@/component/tool-view';
import PPTPlanPreview from '@/component/ppt-plan-preview';
import type { PlannerAgentUIMessage } from '@/agent/planner/agent';
import type { ProjectListPagination, ProjectRecord, ProjectSummary, Slide } from '@/lib/project-types';
import {
  addSlide,
  createProject,
  deleteProject,
  deleteSlide,
  getProject,
  listProjects,
  renameProject,
  reorderSlides,
  replaceProjectSlides,
  updateProjectMessages,
  updateProjectTitleAndMessages,
  updateSlide,
} from '@/lib/project-api';
import { DEFAULT_PROJECT_LIST_PAGE, DEFAULT_PROJECT_LIST_PAGE_SIZE } from '@/lib/project-helpers';

const DEFAULT_PROJECT_TITLE = 'New Project';
const MESSAGE_SYNC_DELAY_MS = 800;

const EMPTY_PAGINATION: ProjectListPagination = {
  page: DEFAULT_PROJECT_LIST_PAGE,
  pageSize: DEFAULT_PROJECT_LIST_PAGE_SIZE,
  total: 0,
  totalPages: 1,
};

const ThinkingBlock = memo(function ThinkingBlock({ content, isComplete }: { content: string; isComplete?: boolean }) {
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    if (isComplete) {
      setIsOpen(false);
    }
  }, [isComplete]);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden my-2 bg-gray-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 p-2 bg-gray-100 hover:bg-gray-200 transition-colors text-xs font-medium text-gray-600"
      >
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <BrainCircuit size={14} />
        <span>Thinking Process</span>
      </button>

      {isOpen && (
        <div className="p-3 text-sm text-gray-600 font-mono whitespace-pre-wrap border-t border-gray-200 bg-gray-50/50">
          {content}
        </div>
      )}
    </div>
  );
});

function extractAutoTitle(messages: any[]) {
  const firstMessage = messages.find((message) => message?.role === 'user');
  if (!firstMessage) return DEFAULT_PROJECT_TITLE;
  const textPart = Array.isArray(firstMessage.parts)
    ? firstMessage.parts.find((part: any) => part?.type === 'text')?.text
    : firstMessage.content;
  if (typeof textPart !== 'string' || !textPart.trim()) return DEFAULT_PROJECT_TITLE;
  return textPart.trim().slice(0, 30);
}

function slideChanged(prev: Slide, next: Slide) {
  return (
    prev.type !== next.type ||
    prev.title !== next.title ||
    prev.description !== next.description ||
    (prev.content ?? '') !== (next.content ?? '') ||
    (prev.imagePath ?? '') !== (next.imagePath ?? '') ||
    (prev.audioPath ?? '') !== (next.audioPath ?? '')
  );
}

function serializeMessages(messages: any[]) {
  return JSON.stringify(messages);
}

async function syncManualPlanChanges(projectId: string, previousPlan: { slides: Slide[] } | undefined, nextPlan: { slides: Slide[] }) {
  const previousSlides = previousPlan?.slides ?? [];
  const previousById = new Map(previousSlides.map((slide) => [slide.id, slide]));
  const incomingIds = new Set(nextPlan.slides.map((slide) => slide.id));

  for (const previousSlide of previousSlides) {
    if (!incomingIds.has(previousSlide.id)) {
      await deleteSlide(projectId, previousSlide.id);
    }
  }

  const resolvedSlides: Slide[] = [];

  for (const slide of nextPlan.slides) {
    const existing = previousById.get(slide.id);
    if (existing) {
      if (slideChanged(existing, slide)) {
        resolvedSlides.push(await updateSlide(projectId, slide.id, slide));
      } else {
        resolvedSlides.push(slide);
      }
      continue;
    }

    resolvedSlides.push(await addSlide(projectId, slide));
  }

  if (resolvedSlides.length > 0) {
    await reorderSlides(
      projectId,
      resolvedSlides.map((slide) => slide.id),
    );
  }

  return { slides: resolvedSlides };
}

function ChatInterface({
  project,
  onProjectUpdate,
}: {
  project: ProjectRecord;
  onProjectUpdate: (project: Partial<ProjectRecord> & { id: string }) => void;
}) {
  const router = useRouter();
  const chatId = project.id;
  const { status, sendMessage, messages, stop, setMessages, addToolApprovalResponse } = useChat<PlannerAgentUIMessage>({
    id: chatId,
  });

  const [autoApproveAfter, setAutoApproveAfter] = useState(false);
  const [pptPlan, setPptPlan] = useState(project.pptPlan);
  const processedToolCallIds = useRef<Set<string>>(new Set());
  const processedApprovalIds = useRef<Set<string>>(new Set());
  const hasInitializedToolCallsRef = useRef(false);
  const projectTitleRef = useRef(project.title);
  const syncTimerRef = useRef<number | null>(null);
  const latestMessagesRef = useRef<any[]>(project.messages ?? []);
  const lastSyncedSignatureRef = useRef(serializeMessages(project.messages ?? []));
  const isPersistingRef = useRef(false);
  const shouldPersistAgainRef = useRef(false);

  const persistMessages = useCallback(async () => {
    if (isPersistingRef.current) {
      shouldPersistAgainRef.current = true;
      return;
    }

    isPersistingRef.current = true;

    try {
      do {
        shouldPersistAgainRef.current = false;
        const nextMessages = latestMessagesRef.current;
        const nextSignature = serializeMessages(nextMessages);
        const nextTitle =
          projectTitleRef.current === DEFAULT_PROJECT_TITLE ? extractAutoTitle(nextMessages) : projectTitleRef.current;
        const needsTitleUpdate = nextTitle !== projectTitleRef.current;

        if (nextSignature === lastSyncedSignatureRef.current && !needsTitleUpdate) {
          continue;
        }

        if (needsTitleUpdate) {
          await updateProjectTitleAndMessages(chatId, nextTitle, nextMessages);
          projectTitleRef.current = nextTitle;
          lastSyncedSignatureRef.current = nextSignature;
          onProjectUpdate({ id: chatId, title: nextTitle, messages: nextMessages, updatedAt: Date.now() });
          continue;
        }

        await updateProjectMessages(chatId, nextMessages);
        lastSyncedSignatureRef.current = nextSignature;
        onProjectUpdate({ id: chatId, messages: nextMessages, updatedAt: Date.now() });
      } while (shouldPersistAgainRef.current);
    } catch (error) {
      console.error('Failed to persist project messages:', error);
    } finally {
      isPersistingRef.current = false;
    }
  }, [chatId, onProjectUpdate]);

  const schedulePersist = useCallback(
    (immediate = false) => {
      if (syncTimerRef.current) {
        window.clearTimeout(syncTimerRef.current);
      }

      if (immediate) {
        void persistMessages();
        return;
      }

      syncTimerRef.current = window.setTimeout(() => {
        syncTimerRef.current = null;
        void persistMessages();
      }, MESSAGE_SYNC_DELAY_MS);
    },
    [persistMessages],
  );

  useEffect(() => {
    setMessages(project.messages ?? []);
    latestMessagesRef.current = project.messages ?? [];
    lastSyncedSignatureRef.current = serializeMessages(project.messages ?? []);
    setPptPlan(project.pptPlan);
    projectTitleRef.current = project.title;

    const restoredToolCallIds = new Set<string>();
    (project.messages ?? []).forEach((message: any) => {
      const parts = message?.parts;
      if (!Array.isArray(parts)) return;
      parts.forEach((part: any) => {
        const partType = part?.type;
        if (partType !== 'tool-create_ppt_plan') return;
        const toolCallId =
          part?.toolCallId || part?.toolInvocation?.toolCallId || part?.toolInvocation?.toolCallID;
        if (typeof toolCallId === 'string' && toolCallId) {
          restoredToolCallIds.add(toolCallId);
        }
      });
    });
    processedToolCallIds.current = restoredToolCallIds;
    hasInitializedToolCallsRef.current = true;

    return () => {
      if (syncTimerRef.current) {
        window.clearTimeout(syncTimerRef.current);
      }
    };
  }, [project, setMessages]);

  const submitApproval = useCallback(
    (approvalId: string, approved: boolean, reason?: string, enableAutoApprove?: boolean) => {
      addToolApprovalResponse({ id: approvalId, approved, reason });
      const nextAutoApprove = Boolean(enableAutoApprove) || autoApproveAfter;
      if (enableAutoApprove) {
        setAutoApproveAfter(true);
      }
      void sendMessage(undefined, { body: { id: chatId, autoApprove: nextAutoApprove } });
    },
    [addToolApprovalResponse, autoApproveAfter, chatId, sendMessage],
  );

  useEffect(() => {
    if (!autoApproveAfter) return;

    for (const message of messages) {
      const parts = (message as any)?.parts;
      if (!Array.isArray(parts)) continue;

      for (const part of parts) {
        if (!part || typeof part !== 'object') continue;
        const approvalId = (part as any)?.approval?.id || (part as any)?.toolInvocation?.approval?.id;
        const partState = (part as any)?.state || (part as any)?.toolInvocation?.state;
        if (partState !== 'approval-requested' || !approvalId) continue;
        if (processedApprovalIds.current.has(approvalId)) continue;

        processedApprovalIds.current.add(approvalId);
        submitApproval(approvalId, true);
      }
    }
  }, [autoApproveAfter, messages, submitApproval]);

  useEffect(() => {
    latestMessagesRef.current = messages;

    if (messages.length === 0) {
      return;
    }

    const nextSignature = serializeMessages(messages);
    const mayNeedTitle = projectTitleRef.current === DEFAULT_PROJECT_TITLE && extractAutoTitle(messages) !== DEFAULT_PROJECT_TITLE;
    if (nextSignature === lastSyncedSignatureRef.current && !mayNeedTitle) {
      return;
    }

    const immediate = status !== 'streaming' && status !== 'submitted';
    schedulePersist(immediate);
  }, [messages, schedulePersist, status]);

  const handlePptPlanUpdate = useCallback(
    async (newPlan: { slides: Slide[] }) => {
      const syncedPlan = await syncManualPlanChanges(chatId, pptPlan, newPlan);
      setPptPlan(syncedPlan);
      onProjectUpdate({ id: chatId, pptPlan: syncedPlan });
    },
    [chatId, onProjectUpdate, pptPlan],
  );

  const handleSendMessage = useCallback(
    (text: string, options?: any) => {
      const body: any = {
        id: chatId,
        autoApprove: autoApproveAfter,
        pptPlan,
        ...options,
      };
      sendMessage({ text }, { body });
    },
    [chatId, autoApproveAfter, pptPlan, sendMessage],
  );

  const handleOpenPreview = useCallback(() => {
    router.push(`/preview?id=${chatId}&page=1&refresh=${Date.now()}`);
  }, [chatId, router]);

  useEffect(() => {
    if (!hasInitializedToolCallsRef.current) return;

    const processMessages = async () => {
      for (const message of messages) {
        const parts = (message as any).parts;
        if (!Array.isArray(parts)) continue;

        for (const part of parts) {
          if (!part || typeof part !== 'object') continue;
          const type = (part as any)?.type;
          const partState = (part as any)?.state || (part as any)?.toolInvocation?.state;
          const toolCallId =
            part?.toolCallId || part?.toolInvocation?.toolCallId || part?.toolInvocation?.toolCallID || 'unknown';
          if (processedToolCallIds.current.has(toolCallId)) continue;

          if (type !== 'tool-create_ppt_plan') continue;
          if (partState !== 'result' && partState !== 'output-available') continue;

          const args = part?.args || part?.toolInvocation?.args || part?.input || part?.toolInvocation?.input;
          const output = part?.output || part?.toolInvocation?.output;
          const slides = output?.slides || args?.slides;
          if (!Array.isArray(slides)) continue;

          processedToolCallIds.current.add(toolCallId);

          const persistedSlides = slides.length > 0 ? await replaceProjectSlides(chatId, slides as Slide[]) : [];
          const nextPptPlan = persistedSlides.length > 0 ? { slides: persistedSlides } : undefined;
          setPptPlan(nextPptPlan);
          onProjectUpdate({ id: chatId, pptPlan: nextPptPlan });
        }
      }
    };

    void processMessages();
  }, [messages, chatId, onProjectUpdate]);

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-[#F0F8FF]">
      <div className="flex-1 min-w-0 flex flex-col">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <div className="bg-white p-8 rounded-full border-4 border-[var(--doraemon-blue)] shadow-[8px_8px_0px_rgba(0,0,0,1)] mb-6">
              <BrainCircuit size={64} className="text-[var(--doraemon-blue)]" />
            </div>
            <h2 className="text-3xl font-black mb-2 text-gray-900 tracking-tight">Doraemon Agent</h2>
            <p className="text-lg font-medium text-gray-600 mb-8">What can I help you with today?</p>
            <div className="w-full max-w-3xl">
              <ChatInput status={status} onSubmit={handleSendMessage} stop={stop} isCentered={true} />
            </div>
          </div>
        ) : (
          <>
            {pptPlan?.slides?.length ? (
              <div className="border-b border-gray-200 bg-white">
                <div className="w-full max-w-3xl mx-auto px-4 py-3 flex justify-end">
                  <button
                    onClick={handleOpenPreview}
                    className="px-4 py-2 bg-green-500 text-white font-bold rounded-xl border-2 border-gray-900 hover:brightness-110 active:scale-95 transition-all shadow-[3px_3px_0px_rgba(0,0,0,1)]"
                  >
                    查看 PPT 预览
                  </button>
                </div>
              </div>
            ) : null}

            <div className="flex-1 overflow-y-auto p-4 scroll-smooth">
              <div className="space-y-6 max-w-3xl mx-auto pb-4">
                {messages.map((message) => (
                  <div key={message.id} className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`px-6 py-4 rounded-2xl max-w-[90%] lg:max-w-[80%] transition-all ${
                        message.role === 'user'
                          ? 'bg-[var(--doraemon-yellow)] text-gray-900 border-2 border-gray-900 shadow-[4px_4px_0px_rgba(0,0,0,1)] rounded-br-none'
                          : 'bg-white border-2 border-gray-900 text-gray-900 shadow-[4px_4px_0px_rgba(0,0,0,1)] rounded-bl-none'
                      }`}
                    >
                      <div
                        className={`font-bold text-xs mb-2 uppercase tracking-wide ${
                          message.role === 'user' ? 'text-gray-700' : 'text-[var(--doraemon-blue)]'
                        }`}
                      >
                        {message.role === 'user' ? 'You' : 'Agent'}
                      </div>

                      <div className="space-y-2 overflow-hidden">
                        {message.parts?.map((part, index) => {
                          if (!part || typeof part !== 'object') return null;
                          const partType = (part as any).type;
                          if (!partType) return null;
                          switch (partType) {
                            case 'text': {
                              const text = (part as { text?: string }).text;
                              if (typeof text !== 'string') return null;
                              return (
                                <div key={index} className="prose prose-sm max-w-none dark:prose-invert">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
                                </div>
                              );
                            }

                            case 'reasoning': {
                              const text = (part as { text?: string }).text;
                              if (typeof text !== 'string') return null;
                              return (
                                <ThinkingBlock
                                  key={index}
                                  content={text}
                                  isComplete={
                                    status !== 'streaming' ||
                                    index < (message.parts?.length ?? 0) - 1 ||
                                    messages.indexOf(message) < messages.length - 1
                                  }
                                />
                              );
                            }

                            case 'step-start':
                              return (
                                <div key={index} className="flex items-center gap-2 text-xs text-gray-400 my-1 animate-pulse">
                                  <BrainCircuit size={12} />
                                  <span>Thinking...</span>
                                </div>
                              );

                            case 'tool-create_ppt_plan': {
                              const p = part as any;
                              return (
                                <ToolView
                                  key={index}
                                  invocation={{
                                    toolName: 'create_ppt_plan',
                                    args: p.args || p.toolInvocation?.args || p.input || p.toolInvocation?.input,
                                    result: p.result || p.toolInvocation?.result || p.output || p.toolInvocation?.output,
                                    state: p.state || p.toolInvocation?.state,
                                    toolCallId: p.toolCallId || p.toolInvocation?.toolCallId || 'unknown',
                                    approval: p.approval || p.toolInvocation?.approval,
                                  }}
                                />
                              );
                            }

                            default:
                              return null;
                          }
                        })}
                        {!message.parts && (message as any).content && (
                          <div className="prose prose-sm max-w-none dark:prose-invert">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{(message as any).content}</ReactMarkdown>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {status === 'streaming' && (
                  <div className="flex items-center gap-2 text-gray-400 text-sm ml-4">
                    <Loader2 size={14} className="animate-spin" />
                    <span>Agent is working...</span>
                  </div>
                )}
              </div>
            </div>

            <PPTPlanPreview pptPlan={pptPlan} onUpdate={handlePptPlanUpdate} />

            <div className="border-t border-gray-200 bg-gray-50">
              <div className="w-full max-w-3xl mx-auto px-4 py-4">
                <ChatInput status={status} onSubmit={handleSendMessage} stop={stop} isCentered={false} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectPagination, setProjectPagination] = useState<ProjectListPagination>(EMPTY_PAGINATION);
  const [currentProject, setCurrentProject] = useState<ProjectRecord | null>(null);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isLoadingProjectDetail, setIsLoadingProjectDetail] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  const loadProjectsPage = useCallback(async (page = DEFAULT_PROJECT_LIST_PAGE) => {
    setIsLoadingProjects(true);
    try {
      const data = await listProjects({ page, page_size: DEFAULT_PROJECT_LIST_PAGE_SIZE });
      setProjects(data.items);
      setProjectPagination(data.pagination);
      return data;
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);

  const refreshCurrentProject = useCallback(async (projectId: string) => {
    setIsLoadingProjectDetail(true);
    try {
      const project = await getProject(projectId);
      setCurrentProject(project);
      return project;
    } finally {
      setIsLoadingProjectDetail(false);
    }
  }, []);

  useEffect(() => {
    void loadProjectsPage(DEFAULT_PROJECT_LIST_PAGE);
  }, [loadProjectsPage]);

  const handleSelectProject = useCallback(
    async (id: string) => {
      if (id === currentProject?.id && currentProject) return;
      await refreshCurrentProject(id);
    },
    [currentProject, refreshCurrentProject],
  );

  const handlePageChange = useCallback(
    async (page: number) => {
      if (page < 1 || page > projectPagination.totalPages || page === projectPagination.page) {
        return;
      }
      await loadProjectsPage(page);
    },
    [loadProjectsPage, projectPagination.page, projectPagination.totalPages],
  );

  const handleNewProject = useCallback(async () => {
    if (isCreatingProject) return;
    setIsCreatingProject(true);
    try {
      const projectId = await createProject({ name: DEFAULT_PROJECT_TITLE });
      await loadProjectsPage(DEFAULT_PROJECT_LIST_PAGE);
      await refreshCurrentProject(projectId);
    } finally {
      setIsCreatingProject(false);
    }
  }, [isCreatingProject, loadProjectsPage, refreshCurrentProject]);

  const handleDeleteProject = useCallback(
    async (id: string) => {
      await deleteProject(id);

      if (currentProject?.id === id) {
        setCurrentProject(null);
      }

      let nextPage = projectPagination.page;
      let nextProjectsPage = await loadProjectsPage(nextPage);

      if (nextProjectsPage.items.length === 0 && nextPage > 1) {
        nextPage -= 1;
        nextProjectsPage = await loadProjectsPage(nextPage);
      }

      if (currentProject?.id === id) {
        if (nextProjectsPage.items.length > 0) {
          await refreshCurrentProject(nextProjectsPage.items[0].id);
          return;
        }

        await handleNewProject();
      }
    },
    [currentProject?.id, handleNewProject, loadProjectsPage, projectPagination.page, refreshCurrentProject],
  );

  const handleRenameProject = useCallback(
    async (id: string, newTitle: string) => {
      await renameProject(id, newTitle);
      await loadProjectsPage(projectPagination.page);

      if (currentProject?.id === id) {
        await refreshCurrentProject(id);
      }
    },
    [currentProject?.id, loadProjectsPage, projectPagination.page, refreshCurrentProject],
  );

  const handleProjectUpdate = useCallback((updatedProject: Partial<ProjectRecord> & { id: string }) => {
    setProjects((prev) =>
      prev.map((project) =>
        project.id === updatedProject.id
          ? {
              ...project,
              title: updatedProject.title ?? project.title,
              updatedAt: updatedProject.updatedAt ?? Date.now(),
            }
          : project,
      ),
    );

    setCurrentProject((prev) => {
      if (!prev || prev.id !== updatedProject.id) return prev;
      return {
        ...prev,
        ...updatedProject,
      };
    });
  }, []);

  useEffect(() => {
    if (isLoadingProjects || currentProject || isCreatingProject) return;

    if (projects.length > 0) {
      void refreshCurrentProject(projects[0].id);
      return;
    }

    void handleNewProject();
  }, [currentProject, handleNewProject, isCreatingProject, isLoadingProjects, projects, refreshCurrentProject]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        projects={projects.map((project) => ({
          id: project.id,
          title: project.title,
          createdAt: project.createdAt,
        }))}
        currentProjectId={currentProject?.id ?? null}
        currentPage={projectPagination.page}
        totalPages={projectPagination.totalPages}
        isLoadingProjects={isLoadingProjects}
        isLoadingProjectDetail={isLoadingProjectDetail}
        onSelect={handleSelectProject}
        onPageChange={handlePageChange}
        onNew={handleNewProject}
        onDelete={handleDeleteProject}
        onRename={handleRenameProject}
      />

      <main className="flex-1 relative">
        {currentProject ? (
          <ChatInterface key={currentProject.id} project={currentProject} onProjectUpdate={handleProjectUpdate} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <Loader2 className="animate-spin mr-2" /> Loading...
          </div>
        )}
      </main>
    </div>
  );
}
