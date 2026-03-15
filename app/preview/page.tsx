'use client';

import { ArrowLeft, Sparkles, BookOpen, Lightbulb, FileText, Star, Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useState, useEffect, Suspense } from 'react';

interface Slide {
  type: 'cover' | 'introduction' | 'content' | 'summary' | 'ending';
  title: string;
  description: string;
  content?: string;
}

interface PPTPlan {
  slides: Slide[];
}

function PreviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [plan, setPlan] = useState<PPTPlan | null>(null);

  useEffect(() => {
    const planData = searchParams.get('plan');
    if (planData) {
      try {
        setPlan(JSON.parse(decodeURIComponent(planData)));
      } catch (e) {
        console.error('Failed to parse plan data', e);
      }
    }
  }, [searchParams]);

  const getSlideIcon = (type: string) => {
    switch (type) {
      case 'cover': return <Sparkles size={24} className="text-[var(--doraemon-yellow)]" />;
      case 'introduction': return <BookOpen size={24} className="text-[var(--doraemon-blue)]" />;
      case 'content': return <Lightbulb size={24} className="text-yellow-500" />;
      case 'summary': return <FileText size={24} className="text-green-500" />;
      case 'ending': return <Star size={24} className="text-pink-500" />;
      default: return <FileText size={24} />;
    }
  };

  const getSlideTypeLabel = (type: string) => {
    switch (type) {
      case 'cover': return '封面页';
      case 'introduction': return '引入页';
      case 'content': return '正文页';
      case 'summary': return '总结页';
      case 'ending': return '结束页';
      default: return type;
    }
  };

  const getSlideBgColor = (type: string) => {
    switch (type) {
      case 'cover': return 'bg-gradient-to-br from-yellow-100 to-yellow-200';
      case 'introduction': return 'bg-gradient-to-br from-blue-100 to-blue-200';
      case 'content': return 'bg-gradient-to-br from-amber-100 to-amber-200';
      case 'summary': return 'bg-gradient-to-br from-green-100 to-green-200';
      case 'ending': return 'bg-gradient-to-br from-pink-100 to-pink-200';
      default: return 'bg-gradient-to-br from-gray-100 to-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F8FF]">
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b-4 border-gray-900 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 p-3 bg-[var(--doraemon-blue)] text-white rounded-xl border-2 border-gray-900 hover:brightness-110 active:scale-95 transition-all shadow-[3px_3px_0px_rgba(0,0,0,1)]"
          >
            <ArrowLeft size={20} />
            <span className="font-bold">返回规划阶段</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--doraemon-yellow)] rounded-full border-2 border-gray-900 flex items-center justify-center">
              <Sparkles size={24} className="text-gray-900" />
            </div>
            <h1 className="text-xl font-black text-gray-900">PPT 预览</h1>
          </div>
          <div className="w-40"></div>
        </div>
      </div>

      <div className="pt-24 pb-12 px-4">
        <div className="max-w-6xl mx-auto">
          {plan && plan.slides.length > 0 ? (
            <div className="space-y-8">
              {plan.slides.map((slide, index) => (
                <div
                  key={index}
                  className={`${getSlideBgColor(slide.type)} border-4 border-gray-900 rounded-3xl p-8 shadow-[8px_8px_0px_rgba(0,0,0,1)]`}
                >
                  <div className="flex items-start gap-6">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-white rounded-full border-4 border-gray-900 flex items-center justify-center shadow-[3px_3px_0px_rgba(0,0,0,1)]">
                        <span className="text-2xl font-black text-gray-900">{index + 1}</span>
                      </div>
                      <div className="w-12 h-12 bg-white rounded-full border-3 border-gray-900 flex items-center justify-center">
                        {getSlideIcon(slide.type)}
                      </div>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-4">
                        <span className="px-4 py-1 bg-white rounded-full border-2 border-gray-900 text-sm font-black text-gray-900 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                          {getSlideTypeLabel(slide.type)}
                        </span>
                      </div>
                      <h2 className="text-4xl font-black text-gray-900 mb-4 tracking-tight">
                        {slide.title}
                      </h2>
                      <p className="text-xl text-gray-700 mb-6 leading-relaxed">
                        {slide.description}
                      </p>
                      {slide.content && (
                        <div className="bg-white rounded-2xl border-3 border-gray-900 p-6 shadow-[3px_3px_0px_rgba(0,0,0,1)]">
                          <div className="prose prose-lg max-w-none text-gray-800">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{slide.content}</ReactMarkdown>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
              <div className="bg-white p-12 rounded-full border-4 border-gray-900 shadow-[8px_8px_0px_rgba(0,0,0,1)] mb-8">
                <Sparkles size={64} className="text-[var(--doraemon-blue)]" />
              </div>
              <h2 className="text-3xl font-black text-gray-900 mb-4">PPT 预览</h2>
              <p className="text-lg text-gray-600">暂无 PPT 规划数据，请先创建规划</p>
            </div>
          )}
        </div>
      </div>
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
