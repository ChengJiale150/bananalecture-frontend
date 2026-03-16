import { Dialogue, DIALOGUE_ROLES, DIALOGUE_EMOTIONS, DIALOGUE_SPEEDS } from '../chat-store';

const roleSet = new Set(DIALOGUE_ROLES);
const emotionSet = new Set(DIALOGUE_EMOTIONS);
const speedSet = new Set(DIALOGUE_SPEEDS);

export function normalizeDialogueRole(value: unknown): Dialogue['role'] {
  if (typeof value === 'string' && roleSet.has(value as any)) {
    return value as Dialogue['role'];
  }
  return '旁白';
}

export function normalizeDialogueEmotion(value: unknown): Dialogue['emotion'] {
  if (typeof value === 'string' && emotionSet.has(value as any)) {
    return value as Dialogue['emotion'];
  }
  return '无明显情感';
}

export function normalizeDialogueSpeed(value: unknown): Dialogue['speed'] {
  if (typeof value === 'string' && speedSet.has(value as any)) {
    return value as Dialogue['speed'];
  }
  if (typeof value === 'number') {
    if (value <= 0.9) return '慢速';
    if (value >= 1.2) return '快速';
    return '中速';
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (!Number.isNaN(parsed)) {
      if (parsed <= 0.9) return '慢速';
      if (parsed >= 1.2) return '快速';
      return '中速';
    }
  }
  return '中速';
}

// Helper to parse JSON safely
export function parseJSON<T>(text: string | null, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}
