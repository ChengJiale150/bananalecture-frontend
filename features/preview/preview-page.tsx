'use client';

import { Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { DialogueList } from '@/features/preview/components/dialogue-list';
import { EmptyState } from '@/features/preview/components/empty-state';
import { PreviewFooter } from '@/features/preview/components/preview-footer';
import { PreviewHeader } from '@/features/preview/components/preview-header';
import { SlideViewer } from '@/features/preview/components/slide-viewer';
import { usePreviewState } from '@/features/preview/hooks/use-preview-state';

function PreviewContent() {
  const searchParams = useSearchParams();
  const projectIdFromUrl = searchParams.get('id');
  const pageFromUrl = searchParams.get('page');
  
  const {
    plan,
    currentSlideIndex,
    setCurrentSlideIndex,
    isLoading,
    isGeneratingAll,
    isSavingDialogues,
    generationProgress,
    activeTask,
    currentSlide,
    displayDialogues,
    handleGenerateDialogues,
    handleGenerateAllDialogues,
    handleGenerateAllImages,
    handleGenerateAllAudio,
    handleGenerateVideo,
    handleStopGeneration,
    handleForceRefresh,
    handleSaveManualDialogues,
    handleGenerateImage,
    handleGenerateAudio,
    handleOpenSlideAudio,
    handleOpenSlideImage,
    handleOpenVideo,
  } = usePreviewState(projectIdFromUrl, pageFromUrl);

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
      <PreviewHeader 
        plan={plan}
        currentSlideIndex={currentSlideIndex}
        isGeneratingAll={isGeneratingAll}
        generationProgress={generationProgress}
        activeTask={activeTask}
        handleStopGeneration={handleStopGeneration}
        handleGenerateAllDialogues={handleGenerateAllDialogues}
        handleGenerateAllImages={handleGenerateAllImages}
        handleGenerateAllAudio={handleGenerateAllAudio}
        handleGenerateVideo={handleGenerateVideo}
        handleOpenVideo={handleOpenVideo}
        handleForceRefresh={handleForceRefresh}
      />

      {plan && plan.slides.length > 0 && currentSlide ? (
        <div className="flex-1 flex overflow-hidden">
          <SlideViewer 
            currentSlide={currentSlide}
            isGeneratingAll={isGeneratingAll}
            handleGenerateDialogues={handleGenerateDialogues}
            handleGenerateImage={handleGenerateImage}
            handleGenerateAudio={handleGenerateAudio}
            handleOpenSlideAudio={handleOpenSlideAudio}
            handleOpenSlideImage={handleOpenSlideImage}
          />
          <DialogueList
            dialogues={displayDialogues}
            isSaving={isSavingDialogues}
            onSave={handleSaveManualDialogues}
          />
        </div>
      ) : (
        <EmptyState />
      )}

      {plan && plan.slides.length > 0 && (
        <PreviewFooter 
          currentSlideIndex={currentSlideIndex}
          totalSlides={plan.slides.length}
          onPageSelect={(page) => setCurrentSlideIndex(page - 1)}
        />
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
