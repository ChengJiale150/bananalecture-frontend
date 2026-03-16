import { Dialogue, PPTPlan, Slide } from '@/lib/chat-store';

export interface StoredPreviewPlan {
  projectId?: string;
  slides: Slide[];
}

export async function fetchChat(id: string) {
  const res = await fetch(`/api/history?id=${id}`);
  if (!res.ok) return null;
  return res.json();
}

export async function saveChatToApi(chat: {
  id: string;
  title?: string;
  messages?: any[];
  pptPlan?: PPTPlan;
}) {
  await fetch('/api/history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(chat),
  });
}

export function createClientId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getEmotionDisplay(emotion?: string) {
  switch (emotion) {
    case '开心的':
      return { emoji: '😊', label: '开心的' };
    case '悲伤的':
      return { emoji: '😢', label: '悲伤的' };
    case '生气的':
      return { emoji: '😠', label: '生气的' };
    case '害怕的':
      return { emoji: '😨', label: '害怕的' };
    case '惊讶的':
      return { emoji: '😲', label: '惊讶的' };
    default:
      return { emoji: '😐', label: '无明显情感' };
  }
}

export function getSpeedDisplay(speed?: string) {
  switch (speed) {
    case '慢速':
      return { label: '慢速', className: 'bg-blue-50 text-blue-700 border-blue-200' };
    case '快速':
      return { label: '快速', className: 'bg-orange-50 text-orange-700 border-orange-200' };
    default:
      return { label: '中速', className: 'bg-green-50 text-green-700 border-green-200' };
  }
}

export function normalizeDialogues(dialogues: any[]): Dialogue[] {
  return dialogues.map((dialogue, idx) => ({
    id: dialogue?.id || `${Date.now()}-${idx}`,
    role: dialogue?.role || '旁白',
    content: dialogue?.content || '',
    emotion: dialogue?.emotion || '无明显情感',
    speed: dialogue?.speed || '中速',
    audioPath: dialogue?.audioPath,
  }));
}
