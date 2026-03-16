import { Dialogue } from '@/lib/chat-store';
import { Play, Edit2, Trash2, ChevronUp, ChevronDown, Plus } from 'lucide-react';
import { getEmotionDisplay, getSpeedDisplay } from '../utils';

interface DialogueListProps {
  dialogues: Dialogue[];
}

export function DialogueList({ dialogues }: DialogueListProps) {
  return (
    <div className="w-[450px] bg-white flex flex-col border-l-2 border-gray-200">
      <div className="p-4 border-b border-gray-100 bg-gray-50">
        <h3 className="font-black text-gray-900">口播稿对话</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {dialogues.map((dialogue) => {
          const emotion = getEmotionDisplay(dialogue.emotion);
          const speed = getSpeedDisplay(dialogue.speed);
          return (
            <div key={dialogue.id} className="bg-white border-2 border-gray-200 rounded-2xl p-4 hover:border-gray-300 transition-colors shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[var(--doraemon-blue)]">{dialogue.role}</span>
                  <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-full border border-gray-200">
                    {emotion.emoji} {emotion.label}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full border ${speed.className}`}>
                    {speed.label}
                  </span>
                  <button className="p-1 text-[var(--doraemon-blue)] hover:bg-blue-50 rounded-full transition-colors" title="播放音频">
                    <Play size={14} />
                  </button>
                </div>
                <div className="flex items-center gap-1 text-gray-400">
                  <button className="p-1 hover:text-gray-700 rounded hover:bg-gray-100"><ChevronUp size={16} /></button>
                  <button className="p-1 hover:text-gray-700 rounded hover:bg-gray-100"><ChevronDown size={16} /></button>
                  <button className="p-1 hover:text-[var(--doraemon-blue)] rounded hover:bg-blue-50"><Edit2 size={16} /></button>
                  <button className="p-1 hover:text-[var(--doraemon-red)] rounded hover:bg-red-50"><Trash2 size={16} /></button>
                </div>
              </div>
              <p className="text-gray-800 text-sm leading-relaxed">{dialogue.content}</p>
            </div>
          );
        })}

        {dialogues.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-gray-300 p-6 text-center text-gray-500">
            当前页暂无口播稿，请点击“生成口播稿”开始生成。
          </div>
        )}

        <button className="w-full py-4 border-2 border-dashed border-[var(--doraemon-blue)] text-[var(--doraemon-blue)] rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-50 transition-colors">
          <Plus size={20} />
          添加对话
        </button>
      </div>
    </div>
  );
}
