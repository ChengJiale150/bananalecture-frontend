'use client';

import { ArrowLeft, Sparkles, FileText, Loader2, Play, RefreshCw, Volume2, Settings, ExternalLink, ChevronDown, Plus, Edit2, Trash2, ChevronUp, ChevronRight, ChevronLeft, Video, Image as ImageIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useState, useEffect, Suspense, useRef, useMemo, useCallback } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { PPTPlan, Slide, Dialogue } from '@/lib/chat-store';
import type { DialogueAgentUIMessage } from '@/agent/dialogue/agent';

interface StoredPreviewPlan {
  chatId?: string;
  slides: Slide[];
}

async function fetchChat(id: string) {
  const res = await fetch(`/api/history?id=${id}`);
  if (!res.ok) return null;
  return res.json();
}

async function saveChatToApi(chat: {
  id: string;
  title?: string;
  messages?: any[];
  pptPlan?: PPTPlan;
}) {
  await fetch('/api/history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(chat),
  });
}

function createClientId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function getEmotionDisplay(emotion?: string) {
  switch (emotion) {
    case '开心的':
      return { emoji: '😊', label: '开心的' };
    case '悲伤的':
      return { emoji: '😢', label: '悲伤的' };
    case '生气的':
      return { emoji: '😠', label: '生气的' };
    case '害怕的':
      return { emoji: '😨', label: '害怕的' };
    case '惊讶的':
      return { emoji: '😲', label: '惊讶的' };
    default:
      return { emoji: '😐', label: '无明显情感' };
  }
}

function getSpeedDisplay(speed?: string) {
  switch (speed) {
    case '慢速':
      return { label: '慢速', className: 'bg-blue-50 text-blue-700 border-blue-200' };
    case '快速':
      return { label: '快速', className: 'bg-orange-50 text-orange-700 border-orange-200' };
    default:
      return { label: '中速', className: 'bg-green-50 text-green-700 border-green-200' };
  }
}

function normalizeDialogues(dialogues: any[]): Dialogue[] {
  return dialogues.map((dialogue, idx) => ({
    id: dialogue?.id || `${Date.now()}-${idx}`,
    role: dialogue?.role || '旁白',
    content: dialogue?.content || '',
    emotion: dialogue?.emotion || '无明显情感',
    speed: dialogue?.speed || '中速',
    audioPath: dialogue?.audioPath,
  }));
}

function PreviewContent() {
  const router = useRouter();
  const [plan, setPlan] = useState<PPTPlan | null>(null);
  const [chatId, setChatId] = useState<string>('');
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [showAdvancedTools, setShowAdvancedTools] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [liveDialoguesBySlide, setLiveDialoguesBySlide] = useState<Record<string, Dialogue[]>>({});
  const processedOutputIdsRef = useRef<Set<string>>(new Set());

  const { status, sendMessage, messages } = useChat<DialogueAgentUIMessage>({
    transport: new DefaultChatTransport({ api: '/api/dialogue' }),
    id: chatId || 'preview-dialogue',
  });

  const syncSessionStorage = useCallback((nextChatId: string, nextPlan: PPTPlan) => {
    sessionStorage.setItem('current_ppt_plan', JSON.stringify({ chatId: nextChatId, slides: nextPlan.slides }));
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
        if (chatId) {
          syncSessionStorage(chatId, nextPlan);
        }
        return nextPlan;
      });
    },
    [chatId, syncSessionStorage],
  );

  useEffect(() => {
    const loadPlan = async () => {
      try {
        const storedPlan = sessionStorage.getItem('current_ppt_plan');
        const parsed = storedPlan ? (JSON.parse(storedPlan) as StoredPreviewPlan | PPTPlan) : null;
        if (!parsed || !Array.isArray((parsed as any).slides)) {
          setIsLoading(false);
          return;
        }
        const slides = (parsed as any).slides as Slide[];
        const initialPlan = { slides };
        const nextChatId =
          (parsed as StoredPreviewPlan).chatId ||
          createClientId();
        setChatId(nextChatId);
        setPlan(initialPlan);
        syncSessionStorage(nextChatId, initialPlan);

        const serverChat = await fetchChat(nextChatId);
        if (serverChat?.pptPlan?.slides?.length) {
          const serverPlan = { slides: serverChat.pptPlan.slides as Slide[] };
          setPlan(serverPlan);
          syncSessionStorage(nextChatId, serverPlan);
        } else {
          await saveChatToApi({
            id: nextChatId,
            title: slides[0]?.title || 'New Chat',
            messages: [],
            pptPlan: initialPlan,
          });
        }
      } catch (e) {
        console.error('Failed to parse plan data from storage', e);
      } finally {
        setIsLoading(false);
      }
    };

    void loadPlan();
  }, [syncSessionStorage]);

  useEffect(() => {
    if (!chatId || !plan) return;
    syncSessionStorage(chatId, plan);
  }, [chatId, plan, syncSessionStorage]);

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
            (typeof input?.slideIndex === 'number' ? plan?.slides[input.slideIndex]?.id : undefined);
          if (partialSlideId) {
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

        if (output?.pptPlan?.slides?.length) {
          const nextPlan = { slides: output.pptPlan.slides as Slide[] };
          setPlan(nextPlan);
          if (chatId) {
            syncSessionStorage(chatId, nextPlan);
          }
        }
      }
    }
  }, [chatId, messages, plan?.slides, syncSessionStorage, upsertSlideDialogues]);

  const currentSlide = plan?.slides[currentSlideIndex];
  const displayDialogues = useMemo(() => {
    if (!currentSlide) return [];
    const live = liveDialoguesBySlide[currentSlide.id];
    if (Array.isArray(live) && live.length > 0) {
      return live;
    }
    if (Array.isArray(currentSlide.dialogues)) {
      return currentSlide.dialogues;
    }
    return [];
  }, [currentSlide, liveDialoguesBySlide]);

  const handleGenerateDialogues = useCallback(() => {
    if (!chatId || !plan || !currentSlide) return;
    setLiveDialoguesBySlide(prev => ({ ...prev, [currentSlide.id]: [] }));
    sendMessage(
      { text: `请为第${currentSlideIndex + 1}页生成口播稿对话` },
      {
        body: {
          id: chatId,
          autoApprove: true,
          pptPlan: plan,
          targetSlideId: currentSlide.id,
          targetSlideIndex: currentSlideIndex,
          previousDialogues: currentSlide.dialogues ?? [],
        },
      },
    );
  }, [chatId, currentSlide, currentSlideIndex, plan, sendMessage]);

  if (isLoading) {
    return (
      <div className="h-screen bg-[#F0F8FF] flex flex-col overflow-hidden">
        <header className="bg-white border-b-4 border-gray-900 shadow-sm h-[72px] animate-pulse" />
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto border-r-2 border-gray-200">
            <div className="flex-1 bg-white border-4 border-gray-900 rounded-3xl p-8 shadow-[8px_8px_0px_rgba(0,0,0,1)] animate-pulse" />
          </div>
          <div className="w-[450px] bg-white flex flex-col border-l-2 border-gray-200 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#F0F8FF] flex flex-col overflow-hidden">
      {/* Top Header */}
      <header className="bg-white border-b-4 border-gray-900 shadow-sm flex-none z-10 relative">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-xl border-2 border-gray-900 hover:bg-gray-200 transition-all shadow-[2px_2px_0px_rgba(0,0,0,1)]"
              title="返回规划空间"
            >
              <ArrowLeft size={18} />
            </button>
            <button className="flex items-center gap-2 px-6 py-2 bg-[var(--doraemon-blue)] text-white font-black rounded-full border-2 border-gray-900 hover:brightness-110 transition-all shadow-[3px_3px_0px_rgba(0,0,0,1)]">
              <Sparkles size={18} />
              一键生成
            </button>
            <button className="flex items-center gap-2 px-6 py-2 bg-white text-orange-500 font-bold rounded-full border-2 border-orange-500 hover:bg-orange-50 transition-all">
              <Video size={18} />
              导出视频
            </button>
          </div>

          <div className="flex items-center gap-4 relative">
            <div className="relative">
              <button 
                onClick={() => setShowAdvancedTools(!showAdvancedTools)}
                className="flex items-center gap-2 px-4 py-2 bg-white text-orange-500 font-bold rounded-full border-2 border-orange-500 hover:bg-orange-50 transition-all"
              >
                <Settings size={18} />
                高级工具 <ChevronDown size={16} />
              </button>
              {showAdvancedTools && (
                <div className="absolute top-full mt-2 right-0 bg-white border-2 border-[var(--doraemon-blue)] rounded-xl shadow-lg w-48 overflow-hidden z-50">
                  <button className="w-full flex items-center gap-2 px-4 py-3 text-[var(--doraemon-blue)] hover:bg-blue-50 border-b border-gray-100">
                    <ImageIcon size={16} />
                    一键生成图片
                  </button>
                  <button className="w-full flex items-center gap-2 px-4 py-3 text-[var(--doraemon-blue)] hover:bg-blue-50 border-b border-gray-100">
                    <FileText size={16} />
                    一键生成口播稿
                  </button>
                  <button className="w-full flex items-center gap-2 px-4 py-3 text-[var(--doraemon-blue)] hover:bg-blue-50 border-b border-gray-100">
                    <Volume2 size={16} />
                    一键生成音频
                  </button>
                  <button className="w-full flex items-center gap-2 px-4 py-3 text-[var(--doraemon-blue)] hover:bg-blue-50">
                    <ExternalLink size={16} />
                    导出视频
                  </button>
                </div>
              )}
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-white text-green-500 font-bold rounded-full border-2 border-green-500 hover:bg-green-50 transition-all">
              <RefreshCw size={18} />
              刷新
            </button>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="px-6 pb-3">
          <div className="flex items-center gap-4">
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[var(--doraemon-blue)] transition-all duration-500 ease-out"
                style={{ width: `${plan ? ((currentSlideIndex + 1) / plan.slides.length) * 100 : 0}%` }}
              ></div>
            </div>
            <span className="text-sm font-bold text-gray-500 min-w-[40px]">
              {plan ? Math.round(((currentSlideIndex + 1) / plan.slides.length) * 100) : 0}%
            </span>
          </div>
        </div>
      </header>

      {/* Main Workspace Area */}
      {plan && plan.slides.length > 0 && currentSlide ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel: Slide Preview */}
          <div className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto border-r-2 border-gray-200">
            <div className="flex-1 bg-white border-4 border-gray-900 rounded-3xl p-8 shadow-[8px_8px_0px_rgba(0,0,0,1)] flex flex-col items-center justify-center min-h-[400px] relative">
              <div className="absolute top-4 left-4 px-4 py-1 bg-gray-100 rounded-full border-2 border-gray-900 text-sm font-black text-gray-900 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                {currentSlide.type}
              </div>
              <h2 className="text-4xl font-black text-gray-900 mb-6 text-center">{currentSlide.title}</h2>
              <p className="text-xl text-gray-700 text-center max-w-2xl">{currentSlide.description}</p>
              
              {/* Partial loading: only render content if it exists and current slide is active */}
              {currentSlide.content && (
                <div className="mt-8 p-6 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300 w-full max-w-3xl overflow-auto max-h-[40vh]">
                  <div className="prose prose-lg max-w-none text-gray-800">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentSlide.content}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex justify-center gap-4 flex-wrap">
              <button
                onClick={handleGenerateDialogues}
                disabled={status === 'streaming' || status === 'submitted'}
                className={`flex items-center gap-2 px-6 py-3 font-bold rounded-full border-2 transition-all ${
                  status === 'streaming' || status === 'submitted'
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    : 'bg-white text-[var(--doraemon-blue)] border-[var(--doraemon-blue)] hover:bg-blue-50'
                }`}
              >
                <FileText size={18} />
                {status === 'streaming' || status === 'submitted' ? '生成中...' : '生成口播稿'}
              </button>
              <button className="flex items-center gap-2 px-6 py-3 bg-[var(--doraemon-blue)] text-white font-bold rounded-full border-2 border-[var(--doraemon-blue)] hover:brightness-110 transition-all">
                <ImageIcon size={18} />
                生成图片
              </button>
              <button className="flex items-center gap-2 px-6 py-3 bg-white text-[var(--doraemon-blue)] font-bold rounded-full border-2 border-[var(--doraemon-blue)] hover:bg-blue-50 transition-all">
                <Edit2 size={18} />
                修改图片
              </button>
              <button className="flex items-center gap-2 px-6 py-3 bg-white text-[var(--doraemon-blue)] font-bold rounded-full border-2 border-[var(--doraemon-blue)] hover:bg-blue-50 transition-all">
                <Volume2 size={18} />
                生成音频
              </button>
              <button className="flex items-center gap-2 px-6 py-3 bg-white text-[var(--doraemon-blue)] font-bold rounded-full border-2 border-[var(--doraemon-blue)] hover:bg-blue-50 transition-all">
                <Play size={18} />
                播放音频
              </button>
            </div>
          </div>

          {/* Right Panel: Dialogues */}
          <div className="w-[450px] bg-white flex flex-col border-l-2 border-gray-200">
            <div className="p-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-black text-gray-900">口播稿对话</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {displayDialogues.map((dialogue) => {
                const emotion = getEmotionDisplay(dialogue.emotion);
                const speed = getSpeedDisplay(dialogue.speed);
                return (
                <div key={dialogue.id} className="bg-white border-2 border-gray-200 rounded-2xl p-4 hover:border-gray-300 transition-colors shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[var(--doraemon-blue)]">{dialogue.role}</span>
                      <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-full border border-gray-200">
                        {emotion.emoji} {emotion.label}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full border ${speed.className}`}>
                        {speed.label}
                      </span>
                      <button className="p-1 text-[var(--doraemon-blue)] hover:bg-blue-50 rounded-full transition-colors" title="播放音频">
                        <Play size={14} />
                      </button>
                    </div>
                    <div className="flex items-center gap-1 text-gray-400">
                      <button className="p-1 hover:text-gray-700 rounded hover:bg-gray-100"><ChevronUp size={16} /></button>
                      <button className="p-1 hover:text-gray-700 rounded hover:bg-gray-100"><ChevronDown size={16} /></button>
                      <button className="p-1 hover:text-[var(--doraemon-blue)] rounded hover:bg-blue-50"><Edit2 size={16} /></button>
                      <button className="p-1 hover:text-[var(--doraemon-red)] rounded hover:bg-red-50"><Trash2 size={16} /></button>
                    </div>
                  </div>
                  <p className="text-gray-800 text-sm leading-relaxed">{dialogue.content}</p>
                </div>
                );
              })}

              {displayDialogues.length === 0 && (
                <div className="rounded-2xl border-2 border-dashed border-gray-300 p-6 text-center text-gray-500">
                  当前页暂无口播稿，请点击“生成口播稿”开始生成。
                </div>
              )}

              <button className="w-full py-4 border-2 border-dashed border-[var(--doraemon-blue)] text-[var(--doraemon-blue)] rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-50 transition-colors">
                <Plus size={20} />
                添加对话
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="bg-white p-12 rounded-full border-4 border-gray-900 shadow-[8px_8px_0px_rgba(0,0,0,1)] mb-8">
            <Sparkles size={64} className="text-[var(--doraemon-blue)]" />
          </div>
          <h2 className="text-3xl font-black text-gray-900 mb-4">工作空间</h2>
          <p className="text-lg text-gray-600">暂无 PPT 规划数据，请先返回创建规划</p>
        </div>
      )}

      {/* Bottom Footer (Pagination) */}
      {plan && plan.slides.length > 0 && (
        <footer className="bg-white border-t-4 border-gray-900 p-4 flex-none z-10">
          <div className="flex items-center justify-center gap-6">
            <button 
              onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))}
              disabled={currentSlideIndex === 0}
              className={`flex items-center gap-2 px-4 py-2 font-bold rounded-xl border-2 transition-all ${
                currentSlideIndex === 0 
                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  : 'bg-white text-gray-700 border-gray-900 hover:bg-gray-50 shadow-[2px_2px_0px_rgba(0,0,0,1)]'
              }`}
            >
              <ChevronLeft size={18} />
              上一页
            </button>
            <span className="font-black text-gray-900 text-lg">
              {currentSlideIndex + 1} / {plan.slides.length}
            </span>
            <button 
              onClick={() => setCurrentSlideIndex(Math.min(plan.slides.length - 1, currentSlideIndex + 1))}
              disabled={currentSlideIndex === plan.slides.length - 1}
              className={`flex items-center gap-2 px-4 py-2 font-bold rounded-xl border-2 transition-all ${
                currentSlideIndex === plan.slides.length - 1
                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  : 'bg-white text-[var(--doraemon-blue)] border-gray-900 hover:bg-blue-50 shadow-[2px_2px_0px_rgba(0,0,0,1)]'
              }`}
            >
              下一页
              <ChevronRight size={18} />
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}

export default function PreviewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F0F8FF] flex items-center justify-center">
        <Loader2 size={48} className="animate-spin text-[var(--doraemon-blue)]" />
      </div>
    }>
      <PreviewContent />
    </Suspense>
  );
}
