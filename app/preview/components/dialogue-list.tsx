import { useEffect, useMemo, useState } from 'react';
import { Dialogue, DIALOGUE_ROLES, DIALOGUE_EMOTIONS, DIALOGUE_SPEEDS } from '@/lib/project-types';
import { Play, Trash2, ChevronUp, ChevronDown, Plus, Save, X } from 'lucide-react';
import { getEmotionDisplay, getSpeedDisplay } from '../utils';

interface DialogueListProps {
  dialogues: Dialogue[];
  isSaving: boolean;
  onSave: (dialogues: Dialogue[]) => Promise<boolean>;
}

function createDialogueId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function DialogueList({ dialogues, isSaving, onSave }: DialogueListProps) {
  const [draftDialogues, setDraftDialogues] = useState<Dialogue[]>(dialogues);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setDraftDialogues(dialogues);
    setIsDirty(false);
  }, [dialogues]);

  const canSave = useMemo(() => {
    if (!isDirty || isSaving) return false;
    return draftDialogues.every((item) => item.content.trim().length > 0);
  }, [draftDialogues, isDirty, isSaving]);

  const updateItem = (index: number, next: Partial<Dialogue>) => {
    setDraftDialogues((prev) => prev.map((item, i) => (i === index ? { ...item, ...next } : item)));
    setIsDirty(true);
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= draftDialogues.length) return;
    const next = [...draftDialogues];
    const current = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = current;
    setDraftDialogues(next);
    setIsDirty(true);
  };

  const removeItem = (index: number) => {
    setDraftDialogues((prev) => prev.filter((_, i) => i !== index));
    setIsDirty(true);
  };

  const addItem = () => {
    setDraftDialogues((prev) => [
      ...prev,
      {
        id: createDialogueId(),
        role: '旁白',
        content: '',
        emotion: '无明显情感',
        speed: '中速',
      },
    ]);
    setIsDirty(true);
  };

  const handleSave = async () => {
    const success = await onSave(draftDialogues);
    if (!success) return;
    setIsDirty(false);
  };

  const handleReset = () => {
    setDraftDialogues(dialogues);
    setIsDirty(false);
  };

  return (
    <div className="w-[450px] bg-white flex flex-col border-l-2 border-gray-200">
      <div className="p-4 border-b border-gray-100 bg-gray-50 space-y-3">
        <h3 className="font-black text-gray-900">口播稿对话</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={!canSave}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl border-2 border-gray-900 font-bold ${
              canSave ? 'bg-green-500 text-white hover:brightness-110' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Save size={16} />
            {isSaving ? '保存中...' : '保存修改'}
          </button>
          <button
            onClick={handleReset}
            disabled={!isDirty || isSaving}
            className={`px-3 py-2 rounded-xl border-2 border-gray-900 font-bold ${
              !isDirty || isSaving ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {draftDialogues.map((dialogue, index) => {
          const emotion = getEmotionDisplay(dialogue.emotion);
          const speed = getSpeedDisplay(dialogue.speed);
          return (
            <div key={dialogue.id} className="bg-white border-2 border-gray-200 rounded-2xl p-4 hover:border-gray-300 transition-colors shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <select
                    value={dialogue.role}
                    onChange={(e) => updateItem(index, { role: e.target.value as Dialogue['role'] })}
                    className="text-sm font-bold text-[var(--doraemon-blue)] border border-gray-300 rounded-lg px-2 py-1"
                  >
                    {DIALOGUE_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <div className="relative cursor-pointer hover:brightness-95 transition-all">
                    <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-full border border-gray-200 flex items-center gap-1">
                      {emotion.emoji} {emotion.label}
                    </span>
                    <select
                      value={dialogue.emotion || '无明显情感'}
                      onChange={(e) => updateItem(index, { emotion: e.target.value as Dialogue['emotion'] })}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      title="点击修改情感"
                    >
                      {DIALOGUE_EMOTIONS.map((item) => (
                        <option key={item} value={item}>
                          {getEmotionDisplay(item).emoji} {item}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="relative cursor-pointer hover:brightness-95 transition-all">
                    <span className={`text-xs px-2 py-1 rounded-full border ${speed.className} flex items-center gap-1`}>
                      {speed.label}
                    </span>
                    <select
                      value={dialogue.speed || '中速'}
                      onChange={(e) => updateItem(index, { speed: e.target.value as Dialogue['speed'] })}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      title="点击修改语速"
                    >
                      {DIALOGUE_SPEEDS.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button className="p-1 text-[var(--doraemon-blue)] hover:bg-blue-50 rounded-full transition-colors" title="播放音频">
                    <Play size={14} />
                  </button>
                </div>
                <div className="flex items-center gap-1 text-gray-400">
                  <button
                    onClick={() => moveItem(index, -1)}
                    className="p-1 hover:text-gray-700 rounded hover:bg-gray-100"
                    disabled={index === 0 || isSaving}
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    onClick={() => moveItem(index, 1)}
                    className="p-1 hover:text-gray-700 rounded hover:bg-gray-100"
                    disabled={index === draftDialogues.length - 1 || isSaving}
                  >
                    <ChevronDown size={16} />
                  </button>
                  <button
                    onClick={() => removeItem(index)}
                    className="p-1 hover:text-[var(--doraemon-red)] rounded hover:bg-red-50"
                    disabled={isSaving}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <textarea
                value={dialogue.content}
                onChange={(e) => updateItem(index, { content: e.target.value })}
                rows={3}
                className="w-full text-gray-800 text-sm leading-relaxed border border-gray-300 rounded-lg p-2 resize-none"
                placeholder="请输入对话内容"
              />
            </div>
          );
        })}

        {draftDialogues.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-gray-300 p-6 text-center text-gray-500">
            当前页暂无口播稿，请点击“生成口播稿”开始生成。
          </div>
        )}

        <button
          onClick={addItem}
          disabled={isSaving}
          className="w-full py-4 border-2 border-dashed border-[var(--doraemon-blue)] text-[var(--doraemon-blue)] rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-50 transition-colors"
        >
          <Plus size={20} />
          添加对话
        </button>
      </div>
    </div>
  );
}
