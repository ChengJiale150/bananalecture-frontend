import type { Slide } from '@/features/projects/types';
import { FileText, Image as ImageIcon, Edit2, Volume2, Play } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface SlideViewerProps {
  currentSlide: Slide;
  isGeneratingAll: boolean;
  handleGenerateDialogues: () => void;
  handleGenerateImage: () => void;
  handleGenerateAudio: () => void;
  handleOpenSlideAudio: () => void;
  handleOpenSlideImage: () => void;
}

export function SlideViewer({
  currentSlide,
  isGeneratingAll,
  handleGenerateDialogues,
  handleGenerateImage,
  handleGenerateAudio,
  handleOpenSlideAudio,
  handleOpenSlideImage,
}: SlideViewerProps) {
  return (
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
        {currentSlide.imagePath && (
          <button
            onClick={handleOpenSlideImage}
            className="mt-6 px-4 py-2 bg-white text-[var(--doraemon-blue)] border-2 border-[var(--doraemon-blue)] rounded-xl font-bold hover:bg-blue-50 transition-colors"
          >
            查看已生成图片
          </button>
        )}
      </div>
      
      <div className="flex justify-center gap-4 flex-wrap">
        <button
          onClick={handleGenerateDialogues}
          disabled={isGeneratingAll}
          className={`flex items-center gap-2 px-6 py-3 font-bold rounded-full border-2 transition-all ${
            isGeneratingAll
              ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
              : 'bg-white text-[var(--doraemon-blue)] border-[var(--doraemon-blue)] hover:bg-blue-50'
          }`}
        >
          <FileText size={18} />
          {isGeneratingAll ? '批量生成中...' : '生成口播稿'}
        </button>
        <button
          onClick={handleGenerateImage}
          className="flex items-center gap-2 px-6 py-3 bg-[var(--doraemon-blue)] text-white font-bold rounded-full border-2 border-[var(--doraemon-blue)] hover:brightness-110 transition-all"
        >
          <ImageIcon size={18} />
          生成图片
        </button>
        <button
          onClick={handleOpenSlideImage}
          className="flex items-center gap-2 px-6 py-3 bg-white text-[var(--doraemon-blue)] font-bold rounded-full border-2 border-[var(--doraemon-blue)] hover:bg-blue-50 transition-all"
        >
          <Edit2 size={18} />
          查看图片
        </button>
        <button
          onClick={handleGenerateAudio}
          className="flex items-center gap-2 px-6 py-3 bg-white text-[var(--doraemon-blue)] font-bold rounded-full border-2 border-[var(--doraemon-blue)] hover:bg-blue-50 transition-all"
        >
          <Volume2 size={18} />
          生成音频
        </button>
        <button
          onClick={handleOpenSlideAudio}
          className="flex items-center gap-2 px-6 py-3 bg-white text-[var(--doraemon-blue)] font-bold rounded-full border-2 border-[var(--doraemon-blue)] hover:bg-blue-50 transition-all"
        >
          <Play size={18} />
          播放音频
        </button>
      </div>
    </div>
  );
}
