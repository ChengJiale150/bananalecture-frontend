import { ArrowLeft, Sparkles, Video, Settings, ChevronDown, FileText, Image as ImageIcon, Volume2, ExternalLink, RefreshCw, Square } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { PPTPlan, TaskProgress } from '@/features/projects/types';

interface PreviewHeaderProps {
  plan: PPTPlan | null;
  currentSlideIndex: number;
  isGeneratingAll: boolean;
  generationProgress: { current: number; total: number; failed: number };
  activeTask: TaskProgress | null;
  handleStopGeneration: () => void;
  handleGenerateAllDialogues: () => void;
  handleGenerateAllImages: () => void;
  handleGenerateAllAudio: () => void;
  handleGenerateVideo: () => void;
  handleOpenVideo: () => void;
  handleForceRefresh: () => void;
}

export function PreviewHeader({
  plan,
  currentSlideIndex,
  isGeneratingAll,
  generationProgress,
  activeTask,
  handleStopGeneration,
  handleGenerateAllDialogues,
  handleGenerateAllImages,
  handleGenerateAllAudio,
  handleGenerateVideo,
  handleOpenVideo,
  handleForceRefresh,
}: PreviewHeaderProps) {
  const router = useRouter();
  const [showAdvancedTools, setShowAdvancedTools] = useState(false);
  const isTaskRunning = Boolean(activeTask && ['pending', 'running'].includes(activeTask.status));

  return (
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
          <button 
            onClick={() => {
              handleGenerateAllDialogues();
            }}
            className="flex items-center gap-2 px-6 py-2 bg-[var(--doraemon-blue)] text-white font-black rounded-full border-2 border-gray-900 hover:brightness-110 transition-all shadow-[3px_3px_0px_rgba(0,0,0,1)]"
          >
            <Sparkles size={18} />
            {isTaskRunning ? '任务进行中' : '一键生成'}
          </button>
          <button
            onClick={handleGenerateVideo}
            className="flex items-center gap-2 px-6 py-2 bg-white text-orange-500 font-bold rounded-full border-2 border-orange-500 hover:bg-orange-50 transition-all"
          >
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
                <button 
                  onClick={() => {
                    handleGenerateAllDialogues();
                    setShowAdvancedTools(false);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-3 text-[var(--doraemon-blue)] hover:bg-blue-50 border-b border-gray-100"
                >
                  <FileText size={16} />
                  一键生成口播稿
                </button>
                <button
                  onClick={() => {
                    handleGenerateAllImages();
                    setShowAdvancedTools(false);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-3 text-[var(--doraemon-blue)] hover:bg-blue-50 border-b border-gray-100"
                >
                  <ImageIcon size={16} />
                  一键生成图片
                </button>
                <button
                  onClick={() => {
                    handleGenerateAllAudio();
                    setShowAdvancedTools(false);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-3 text-[var(--doraemon-blue)] hover:bg-blue-50 border-b border-gray-100"
                >
                  <Volume2 size={16} />
                  一键生成音频
                </button>
                <button
                  onClick={() => {
                    handleOpenVideo();
                    setShowAdvancedTools(false);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-3 text-[var(--doraemon-blue)] hover:bg-blue-50"
                >
                  <ExternalLink size={16} />
                  打开视频
                </button>
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
      
      {/* Progress Bar */}
      <div className="px-6 pb-3">
        <div className="flex items-center gap-4">
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ease-out ${isGeneratingAll ? 'bg-green-500' : 'bg-[var(--doraemon-blue)]'}`}
              style={{ 
                width: `${
                  isGeneratingAll && generationProgress.total > 0
                    ? (generationProgress.current / generationProgress.total) * 100 
                    : (plan ? ((currentSlideIndex + 1) / plan.slides.length) * 100 : 0)
                }%` 
              }}
            ></div>
          </div>
          <span className="text-sm font-bold text-gray-500 min-w-[40px]">
            {isGeneratingAll && generationProgress.total > 0
              ? `${Math.round((generationProgress.current / generationProgress.total) * 100)}%`
              : `${plan ? Math.round(((currentSlideIndex + 1) / plan.slides.length) * 100) : 0}%`
            }
          </span>
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
          {activeTask && (
            <span className="text-xs text-gray-500">
              {activeTask.type}: {activeTask.status}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
