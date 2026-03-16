import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PreviewFooterProps {
  currentSlideIndex: number;
  totalSlides: number;
  onPrev: () => void;
  onNext: () => void;
}

export function PreviewFooter({
  currentSlideIndex,
  totalSlides,
  onPrev,
  onNext,
}: PreviewFooterProps) {
  return (
    <footer className="bg-white border-t-4 border-gray-900 p-4 flex-none z-10">
      <div className="flex items-center justify-center gap-6">
        <button 
          onClick={onPrev}
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
          {currentSlideIndex + 1} / {totalSlides}
        </span>
        <button 
          onClick={onNext}
          disabled={currentSlideIndex === totalSlides - 1}
          className={`flex items-center gap-2 px-4 py-2 font-bold rounded-xl border-2 transition-all ${
            currentSlideIndex === totalSlides - 1
              ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
              : 'bg-white text-[var(--doraemon-blue)] border-gray-900 hover:bg-blue-50 shadow-[2px_2px_0px_rgba(0,0,0,1)]'
          }`}
        >
          下一页
          <ChevronRight size={18} />
        </button>
      </div>
    </footer>
  );
}
