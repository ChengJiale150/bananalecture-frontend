'use client';

import { Sparkles, Maximize2, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { Slide, SlideType } from '@/lib/chat-store';
import PPTPlanModal from './ppt-plan-modal';

interface PPTPlanPreviewProps {
  pptPlan: { slides: Slide[] } | undefined;
  onUpdate: (plan: { slides: Slide[] }) => void;
}

export default function PPTPlanPreview({ pptPlan, onUpdate }: PPTPlanPreviewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!pptPlan || pptPlan.slides.length === 0) {
    return null;
  }

  const slides = pptPlan.slides;

  return (
    <>
      <div className="w-full bg-[#F0F8FF] border-t-2 border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full flex items-center justify-between p-3 bg-white border-2 border-[var(--doraemon-blue)] rounded-xl shadow-[3px_3px_0px_var(--doraemon-blue)] hover:shadow-[4px_4px_0px_var(--doraemon-blue)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-[var(--doraemon-yellow)] rounded-full border-2 border-gray-900">
                <Sparkles size={20} className="text-gray-900" />
              </div>
              <div className="text-left flex-1 min-w-0">
                <div className="font-bold text-gray-900">PPT 规划</div>
                <div className="text-xs text-gray-500 truncate">
                  {slides.slice(0, 3).map(s => s.title).join(' → ')}
                  {slides.length > 3 ? ' ...' : ''}
                </div>
              </div>
              <div className="flex items-center gap-1 ml-4 flex-shrink-0">
                {slides.slice(0, 8).map((slide, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full ${getSlideDotColor(slide.type)}`}
                    title={getSlideTypeLabel(slide.type)}
                  />
                ))}
                {slides.length > 8 && (
                  <div className="text-xs text-gray-400">+{slides.length - 8}</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 text-[var(--doraemon-blue)]">
              <Maximize2 size={18} />
              <ChevronRight size={18} />
            </div>
          </button>
        </div>
      </div>

      {isModalOpen && (
        <PPTPlanModal
          pptPlan={pptPlan}
          onUpdate={onUpdate}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}

function getSlideDotColor(type: SlideType) {
  switch (type) {
    case 'cover': return 'bg-[var(--doraemon-yellow)]';
    case 'introduction': return 'bg-[var(--doraemon-blue)]';
    case 'content': return 'bg-yellow-400';
    case 'summary': return 'bg-green-500';
    case 'ending': return 'bg-pink-500';
    default: return 'bg-gray-400';
  }
}

function getSlideTypeLabel(type: SlideType) {
  switch (type) {
    case 'cover': return '封面页';
    case 'introduction': return '引入页';
    case 'content': return '正文页';
    case 'summary': return '总结页';
    case 'ending': return '结束页';
    default: return type;
  }
}
