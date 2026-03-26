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
    <div className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto border-r-2 border-gray-200">
      <div className="flex-1 bg-white border-4 border-gray-900 rounded-3xl p-8 shadow-[8px_8px_0px_rgba(0,0,0,1)] flex flex-col min-h-[400px] relative">
        <div className="absolute top-4 left-4 px-4 py-1 bg-gray-100 rounded-full border-2 border-gray-900 text-sm font-black text-gray-900 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
          {currentSlide.type}
        </div>
        <h2 className="text-4xl font-black text-gray-900 mb-4 text-center">{currentSlide.title}</h2>
        <p className="text-xl text-gray-700 text-center max-w-2xl mx-auto">{currentSlide.description}</p>

        <div className="mt-8 flex-1 flex flex-col">
          {currentSlide.imagePath && slideImageUrl ? (
            <button
              onClick={handleOpenSlideImage}
              className="flex-1 min-h-[360px] rounded-3xl overflow-hidden border-2 border-gray-900 bg-[#F7FBFF] shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform"
              title="查看原图"
            >
              <img
                src={slideImageUrl}
                alt={currentSlide.title}
                className="h-full w-full object-contain bg-[radial-gradient(circle_at_top,#ffffff,#dbeafe)]"
              />
            </button>
          ) : (
            <div className="flex-1 min-h-[360px] p-6 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-300 overflow-auto">
              <div className="mb-4 flex items-center gap-2 text-sm font-black text-gray-700">
                <FileText size={16} />
                当前尚未生成图片，展示规划稿
              </div>
              <div className="prose prose-lg max-w-none text-gray-800">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {currentSlide.content?.trim() || '当前页暂无规划稿内容。'}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-center gap-4 flex-wrap">
        <button
          onClick={handleGenerateImage}
          disabled={isGeneratingAll || isGeneratingImage}
          className={`flex items-center gap-2 px-6 py-3 font-bold rounded-full border-2 transition-all ${
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
          className={`flex items-center gap-2 px-6 py-3 font-bold rounded-full border-2 transition-all ${
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
          className={`flex items-center gap-2 px-6 py-3 font-bold rounded-full border-2 transition-all ${
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
          className={`flex items-center gap-2 px-6 py-3 font-bold rounded-full border-2 transition-all ${
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
          className={`flex items-center gap-2 px-6 py-3 font-bold rounded-full border-2 transition-all ${
            canPlayAudio
              ? 'bg-white text-[var(--doraemon-blue)] border-[var(--doraemon-blue)] hover:bg-blue-50'
              : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
          }`}
        >
          <Play size={18} />
          播放音频
        </button>
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
    </div>
  );
}
