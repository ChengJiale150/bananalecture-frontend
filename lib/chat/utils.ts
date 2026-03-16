import { Dialogue, DIALOGUE_ROLES, DIALOGUE_EMOTIONS, DIALOGUE_SPEEDS } from '../chat-store';

const roleSet = new Set(DIALOGUE_ROLES);
const emotionSet = new Set(DIALOGUE_EMOTIONS);
const speedSet = new Set(DIALOGUE_SPEEDS);

export const DIALOGUE_WRITE_ACTIONS = [
  'generate_dialogues',
  'manual_edit_dialogues',
  'clear_dialogues_for_regen',
] as const;

export type DialogueWriteAction = (typeof DIALOGUE_WRITE_ACTIONS)[number];

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

export function isDialogueWriteAction(value: unknown): value is DialogueWriteAction {
  return typeof value === 'string' && (DIALOGUE_WRITE_ACTIONS as readonly string[]).includes(value);
}

export function assertDialogueWriteAction(
  action: unknown,
  allowedActions: readonly DialogueWriteAction[],
  operation: string,
): DialogueWriteAction {
  if (!isDialogueWriteAction(action)) {
    throw new Error(`[${operation}] invalid action: ${String(action)}`);
  }
  if (!allowedActions.includes(action)) {
    throw new Error(`[${operation}] action not allowed: ${String(action)}`);
  }
  return action;
}
