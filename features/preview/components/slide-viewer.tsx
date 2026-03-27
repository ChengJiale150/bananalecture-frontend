import { useEffect, useState } from 'react';
import type { Slide } from '@/features/projects/types';
import { FileText, Image as ImageIcon, Edit2, Volume2, Play, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface SlideViewerProps {
  currentSlide: Slide;
  slideImageUrl: string | null;
  isGeneratingAll: boolean;
  isGeneratingImage: boolean;
  isModifyingImage: boolean;
  isGeneratingDialogues: boolean;
  isGeneratingAudio: boolean;
  handleGenerateDialogues: () => void;
  handleGenerateImage: () => void;
  handleModifyImage: (prompt: string) => Promise<boolean>;
  handleGenerateAudio: () => void;
  handleOpenSlideAudio: () => void;
  handleOpenSlideImage: () => void;
}

export function SlideViewer({
  currentSlide,
  slideImageUrl,
  isGeneratingAll,
  isGeneratingImage,
  isModifyingImage,
  isGeneratingDialogues,
  isGeneratingAudio,
  handleGenerateDialogues,
  handleGenerateImage,
  handleModifyImage,
  handleGenerateAudio,
  handleOpenSlideAudio,
  handleOpenSlideImage,
}: SlideViewerProps) {
  const [showModifyDialog, setShowModifyDialog] = useState(false);
  const [modifyPrompt, setModifyPrompt] = useState('');

  useEffect(() => {
    if (!showModifyDialog) {
      setModifyPrompt('');
    }
  }, [showModifyDialog]);

  const canModifyImage = Boolean(currentSlide.imagePath) && !isGeneratingAll && !isModifyingImage;
  const canGenerateAudio = Boolean(currentSlide.dialogues?.length) && !isGeneratingAll && !isGeneratingAudio;
  const canPlayAudio = Boolean(currentSlide.audioPath);
  const hasDialoguePreview = Boolean(currentSlide.dialogues?.length);

  const handleSubmitModifyImage = async () => {
    const prompt = modifyPrompt.trim();
    if (!prompt) {
      return;
    }

    const success = await handleModifyImage(prompt);
    if (success) {
      setShowModifyDialog(false);
    }
  };

  return (
    <section className="min-h-0 rounded-[28px] border-4 border-gray-900 bg-white p-4 shadow-[8px_8px_0px_rgba(0,0,0,1)] lg:p-5">
      <div className="flex h-full min-h-0 flex-col gap-4">
        <div className="rounded-[24px] border-2 border-gray-900 bg-[linear-gradient(135deg,#ffffff_0%,#eef8ff_100%)] px-5 py-4 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
          <div className="mb-3 flex items-start justify-between gap-3">
            <span className="inline-flex rounded-full border-2 border-gray-900 bg-[#FFF4D6] px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-gray-900">
              {currentSlide.type}
            </span>
            <span className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-semibold text-gray-500">
              幻灯片预览
            </span>
          </div>
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-2xl font-black leading-tight text-gray-900 lg:text-[2rem]">
              {currentSlide.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-600 lg:text-base">
              {currentSlide.description}
            </p>
          </div>
        </div>

        <div className="flex-1 min-h-0 rounded-[24px] border-2 border-gray-900 bg-[#F6FBFF] p-4 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
          <div className="flex h-full min-h-0 items-center justify-center">
            {currentSlide.imagePath && slideImageUrl ? (
              <button
                onClick={handleOpenSlideImage}
                className="aspect-video h-auto w-full max-w-[980px] overflow-hidden rounded-[24px] border-2 border-gray-900 bg-[radial-gradient(circle_at_top,#ffffff,#dbeafe)] shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-transform hover:translate-x-[-1px] hover:translate-y-[-1px]"
                title="查看原图"
              >
                <img
                  src={slideImageUrl}
                  alt={currentSlide.title}
                  className="h-full w-full object-contain"
                />
              </button>
            ) : (
              <div className="aspect-video w-full max-w-[980px] overflow-hidden rounded-[24px] border-2 border-dashed border-gray-400 bg-white shadow-[4px_4px_0px_rgba(0,0,0,0.12)]">
                <div className="flex h-full min-h-0 flex-col">
                  <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3 text-sm font-black text-gray-700">
                    <FileText size={16} />
                    {hasDialoguePreview ? '当前尚未生成图片，展示口播稿' : '当前尚未生成图片，展示规划稿'}
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                    {hasDialoguePreview ? (
                      <div className="space-y-3">
                        {currentSlide.dialogues?.map((dialogue, index) => (
                          <div
                            key={dialogue.id}
                            className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-left"
                          >
                            <div className="mb-2 flex items-center gap-2">
                              <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-[var(--doraemon-blue)]">
                                {dialogue.role}
                              </span>
                              <span className="text-xs text-gray-400">#{index + 1}</span>
                            </div>
                            <p className="text-sm leading-6 text-gray-700">
                              {dialogue.content || '当前对话暂无内容。'}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="prose prose-sm max-w-none text-gray-800 lg:prose-base">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {currentSlide.content?.trim() || '当前页暂无规划稿内容。'}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid flex-none gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <button
            onClick={handleGenerateImage}
            disabled={isGeneratingAll || isGeneratingImage}
            className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 px-4 py-3 text-sm font-bold transition-all ${
              isGeneratingAll || isGeneratingImage
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                : 'bg-[var(--doraemon-blue)] text-white border-[var(--doraemon-blue)] hover:brightness-110'
            }`}
          >
            <ImageIcon size={18} />
            {isGeneratingImage ? '生成中...' : '生成图片'}
          </button>
          <button
            onClick={() => setShowModifyDialog(true)}
            disabled={!canModifyImage}
            className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 px-4 py-3 text-sm font-bold transition-all ${
              canModifyImage
                ? 'bg-white text-[var(--doraemon-blue)] border-[var(--doraemon-blue)] hover:bg-blue-50'
                : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
            }`}
          >
            <Edit2 size={18} />
            {isModifyingImage ? '修改中...' : '修改图片'}
          </button>
          <button
            onClick={handleGenerateDialogues}
            disabled={isGeneratingAll || isGeneratingDialogues}
            className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 px-4 py-3 text-sm font-bold transition-all ${
              isGeneratingAll || isGeneratingDialogues
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                : 'bg-white text-[var(--doraemon-blue)] border-[var(--doraemon-blue)] hover:bg-blue-50'
            }`}
          >
            <FileText size={18} />
            {isGeneratingDialogues ? '生成中...' : '生成口播稿'}
          </button>
          <button
            onClick={handleGenerateAudio}
            disabled={!canGenerateAudio}
            className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 px-4 py-3 text-sm font-bold transition-all ${
              canGenerateAudio
                ? 'bg-white text-[var(--doraemon-blue)] border-[var(--doraemon-blue)] hover:bg-blue-50'
                : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
            }`}
          >
            <Volume2 size={18} />
            {isGeneratingAudio ? '生成中...' : '生成音频'}
          </button>
          <button
            onClick={handleOpenSlideAudio}
            disabled={!canPlayAudio}
            className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 px-4 py-3 text-sm font-bold transition-all ${
              canPlayAudio
                ? 'bg-white text-[var(--doraemon-blue)] border-[var(--doraemon-blue)] hover:bg-blue-50'
                : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
            }`}
          >
            <Play size={18} />
            播放音频
          </button>
        </div>
      </div>

      {showModifyDialog ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-3xl border-4 border-gray-900 bg-white p-6 shadow-[8px_8px_0px_rgba(0,0,0,1)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-gray-900">修改图片</h3>
                <p className="text-sm text-gray-500">输入新的改图提示词，调用后端图片修改接口。</p>
              </div>
              <button
                onClick={() => setShowModifyDialog(false)}
                className="rounded-xl border-2 border-gray-900 bg-gray-100 p-2 text-gray-700 hover:bg-gray-200"
                disabled={isModifyingImage}
              >
                <X size={18} />
              </button>
            </div>
            <textarea
              value={modifyPrompt}
              onChange={(event) => setModifyPrompt(event.target.value)}
              rows={5}
              className="w-full rounded-2xl border-2 border-gray-300 p-3 text-sm text-gray-800 outline-none focus:border-[var(--doraemon-blue)]"
              placeholder="例如：把背景改成教室场景，并保持卡通科普风格。"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setShowModifyDialog(false)}
                disabled={isModifyingImage}
                className="rounded-xl border-2 border-gray-900 bg-white px-4 py-2 font-bold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
              >
                取消
              </button>
              <button
                onClick={() => void handleSubmitModifyImage()}
                disabled={!modifyPrompt.trim() || isModifyingImage}
                className="rounded-xl border-2 border-gray-900 bg-[var(--doraemon-blue)] px-4 py-2 font-bold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {isModifyingImage ? '提交中...' : '确认修改'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
