import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getVisiblePaginationPages } from '@/features/projects/utils';

interface PreviewFooterProps {
  currentSlideIndex: number;
  totalSlides: number;
  onPageSelect: (page: number) => void;
}

export function PreviewFooter({
  currentSlideIndex,
  totalSlides,
  onPageSelect,
}: PreviewFooterProps) {
  const currentPage = currentSlideIndex + 1;
  const visiblePages = getVisiblePaginationPages(currentPage, totalSlides, 2);

  return (
    <footer className="bg-white border-t-4 border-gray-900 p-4 flex-none z-10">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => onPageSelect(currentPage - 1)}
          disabled={currentPage === 1}
          className={`flex items-center gap-2 px-4 py-2 font-bold rounded-xl border-2 transition-all ${
            currentPage === 1
              ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
              : 'bg-white text-gray-700 border-gray-900 hover:bg-gray-50 shadow-[2px_2px_0px_rgba(0,0,0,1)]'
          }`}
        >
          <ChevronLeft size={18} />
          上一页
        </button>

        <div className="flex items-center gap-2 rounded-2xl border-2 border-gray-900 bg-[#F0F8FF] px-3 py-2 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
          {visiblePages.map((page) => (
            <button
              key={page}
              onClick={() => onPageSelect(page)}
              className={`min-w-10 rounded-xl border-2 px-3 py-2 text-sm font-black transition-all ${
                page === currentPage
                  ? 'border-gray-900 bg-[var(--doraemon-blue)] text-white'
                  : 'border-transparent bg-white text-gray-700 hover:border-gray-900'
              }`}
            >
              {page}
            </button>
          ))}
        </div>

        <span className="font-black text-gray-900 text-lg">
          第 {currentPage} / {totalSlides} 页
        </span>

        <button
          onClick={() => onPageSelect(currentPage + 1)}
          disabled={currentPage === totalSlides}
          className={`flex items-center gap-2 px-4 py-2 font-bold rounded-xl border-2 transition-all ${
            currentPage === totalSlides
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
