import {
  ArrowLeft,
  ChevronDown,
  Download,
  FileText,
  Image as ImageIcon,
  RefreshCw,
  Settings,
  Sparkles,
  Square,
  Video,
  Volume2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { GenerationSessionState, GenerationStage, PPTPlan } from '@/features/projects/types';
import { getCurrentGenerationStageState } from '@/features/preview/utils/generation-session';

interface PreviewHeaderProps {
  plan: PPTPlan | null;
  currentSlideIndex: number;
  isGeneratingAll: boolean;
  generationSession: GenerationSessionState | null;
  overallGenerationProgress: number;
  currentStageTaskProgress: number;
  hasVideo: boolean;
  handleStopGeneration: () => void;
  handleGenerateAll: () => void;
  handleStartStageGeneration: (stage: GenerationStage) => void;
  handleDownloadVideo: () => void;
  handleForceRefresh: () => void;
}

const ADVANCED_ACTIONS: Array<{ stage: GenerationStage; label: string; icon: typeof ImageIcon }> = [
  { stage: 'images', label: '一键生成图片', icon: ImageIcon },
  { stage: 'dialogues', label: '一键生成口播稿', icon: FileText },
  { stage: 'audio', label: '一键生成音频', icon: Volume2 },
  { stage: 'video', label: '一键生成视频', icon: Video },
];

function getStatusCopy(session: GenerationSessionState | null) {
  if (!session) {
    return '当前没有批量生成任务';
  }

  const currentStage = getCurrentGenerationStageState(session);
  if (!currentStage) {
    return '生成任务已结束';
  }

  const prefix = session.mode === 'pipeline' ? '一键生成' : '单阶段生成';
  switch (session.status) {
    case 'completed':
      return `${prefix}已完成`;
    case 'failed':
      return `${prefix}失败: ${session.errorMessage ?? `${currentStage.label}任务失败`}`;
    case 'cancelled':
      return `${prefix}已停止`;
    default:
      return `${prefix}进行中: ${currentStage.label} ${Math.round(currentStage.progress)}%`;
  }
}

export function PreviewHeader({
  plan,
  currentSlideIndex,
  isGeneratingAll,
  generationSession,
  overallGenerationProgress,
  currentStageTaskProgress,
  hasVideo,
  handleStopGeneration,
  handleGenerateAll,
  handleStartStageGeneration,
  handleDownloadVideo,
  handleForceRefresh,
}: PreviewHeaderProps) {
  const router = useRouter();
  const [showAdvancedTools, setShowAdvancedTools] = useState(false);
  const currentStage = getCurrentGenerationStageState(generationSession);
  const progressText = useMemo(() => {
    if (generationSession) {
      return `${Math.round(overallGenerationProgress)}%`;
    }

    return `${plan ? Math.round(((currentSlideIndex + 1) / plan.slides.length) * 100) : 0}%`;
  }, [currentSlideIndex, generationSession, overallGenerationProgress, plan]);

  return (
    <header className="bg-white border-b-4 border-gray-900 shadow-sm flex-none z-10 relative">
      <div className="px-6 py-4 flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-xl border-2 border-gray-900 hover:bg-gray-200 transition-all shadow-[2px_2px_0px_rgba(0,0,0,1)]"
            title="返回规划空间"
          >
            <ArrowLeft size={18} />
          </button>
          <button
            onClick={handleGenerateAll}
            disabled={isGeneratingAll}
            className={`flex items-center gap-2 px-6 py-3 text-white font-black rounded-full border-2 border-gray-900 transition-all shadow-[3px_3px_0px_rgba(0,0,0,1)] ${
              isGeneratingAll
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-[var(--doraemon-blue)] hover:brightness-110'
            }`}
          >
            <Sparkles size={18} />
            {isGeneratingAll ? '生成进行中' : '一键生成'}
          </button>
          <button
            onClick={handleDownloadVideo}
            disabled={!hasVideo}
            className={`flex items-center gap-2 px-6 py-3 font-bold rounded-full border-2 transition-all ${
              hasVideo
                ? 'bg-white text-orange-500 border-orange-500 hover:bg-orange-50'
                : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
            }`}
          >
            <Download size={18} />
            下载视频
          </button>
        </div>

        <div className="flex items-center gap-4 relative">
          <div className="relative">
            <button
              onClick={() => setShowAdvancedTools((value) => !value)}
              className="flex items-center gap-2 px-4 py-2 bg-white text-orange-500 font-bold rounded-full border-2 border-orange-500 hover:bg-orange-50 transition-all"
            >
              <Settings size={18} />
              高级功能 <ChevronDown size={16} />
            </button>
            {showAdvancedTools && (
              <div className="absolute top-full mt-2 right-0 bg-white border-2 border-[var(--doraemon-blue)] rounded-xl shadow-lg w-56 overflow-hidden z-50">
                {ADVANCED_ACTIONS.map((action, index) => {
                  const Icon = action.icon;

                  return (
                    <button
                      key={action.stage}
                      onClick={() => {
                        void handleStartStageGeneration(action.stage);
                        setShowAdvancedTools(false);
                      }}
                      disabled={isGeneratingAll}
                      className={`w-full flex items-center gap-2 px-4 py-3 text-left text-[var(--doraemon-blue)] hover:bg-blue-50 ${
                        index < ADVANCED_ACTIONS.length - 1 ? 'border-b border-gray-100' : ''
                      } ${isGeneratingAll ? 'cursor-not-allowed bg-gray-50 text-gray-300' : ''}`}
                    >
                      <Icon size={16} />
                      {action.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <button
            onClick={handleForceRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-white text-green-500 font-bold rounded-full border-2 border-green-500 hover:bg-green-50 transition-all"
          >
            <RefreshCw size={18} />
            刷新
          </button>
        </div>
      </div>

      <div className="px-6 pb-4">
        <div className="rounded-3xl border-2 border-gray-900 bg-[#F7FBFF] p-4 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <p className="text-sm font-black text-gray-900">生成进度</p>
              <p className="text-sm text-gray-600">{getStatusCopy(generationSession)}</p>
            </div>
            <div className="flex items-center gap-3">
              {generationSession && (
                <div className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-bold text-gray-600">
                  当前阶段 {Math.round(currentStageTaskProgress)}%
                </div>
              )}
              <div className="rounded-full border border-gray-900 bg-white px-3 py-1 text-sm font-black text-gray-900">
                {progressText}
              </div>
              {isGeneratingAll && (
                <button
                  onClick={handleStopGeneration}
                  className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-600 rounded-lg text-sm font-bold hover:bg-red-200 transition-colors"
                  title="停止生成"
                >
                  <Square size={14} fill="currentColor" />
                  停止
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {(generationSession?.stages ?? []).map((stage) => {
              const isActive = currentStage?.stage === stage.stage && generationSession?.status === 'running';
              const backgroundClass =
                stage.status === 'completed'
                  ? 'bg-green-100 border-green-300'
                  : stage.status === 'failed'
                    ? 'bg-red-100 border-red-300'
                    : stage.status === 'cancelled'
                      ? 'bg-gray-100 border-gray-300'
                      : isActive
                        ? 'bg-blue-100 border-[var(--doraemon-blue)]'
                        : 'bg-white border-gray-200';

              return (
                <div key={stage.stage} className={`rounded-2xl border-2 p-3 transition-all ${backgroundClass}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-black text-gray-900">{stage.label}</span>
                    <span className="text-xs font-bold text-gray-500">{Math.round(stage.progress)}%</span>
                  </div>
                  <div className="h-2 bg-white/80 rounded-full overflow-hidden border border-white">
                    <div
                      className={`h-full transition-all duration-500 ${
                        stage.status === 'failed'
                          ? 'bg-red-500'
                          : stage.status === 'cancelled'
                            ? 'bg-gray-400'
                            : stage.status === 'completed'
                              ? 'bg-green-500'
                              : 'bg-[var(--doraemon-blue)]'
                      }`}
                      style={{ width: `${stage.progress}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {!generationSession &&
              ADVANCED_ACTIONS.map((action) => (
                <div key={action.stage} className="rounded-2xl border-2 border-gray-200 bg-white p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-black text-gray-900">
                      {action.stage === 'images'
                        ? '图片'
                        : action.stage === 'dialogues'
                          ? '口播稿'
                          : action.stage === 'audio'
                            ? '音频'
                            : '视频'}
                    </span>
                    <span className="text-xs font-bold text-gray-400">0%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-200" />
                </div>
              ))}
          </div>
        </div>
      </div>
    </header>
  );
}
