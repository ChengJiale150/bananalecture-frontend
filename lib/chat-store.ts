export type SlideType = 'cover' | 'introduction' | 'content' | 'summary' | 'ending';

export const DIALOGUE_ROLES = ['大雄', '哆啦A梦', '旁白', '其他男声', '其他女声', '道具'] as const;
export const DIALOGUE_EMOTIONS = ['开心的', '悲伤的', '生气的', '害怕的', '惊讶的', '无明显情感'] as const;
export const DIALOGUE_SPEEDS = ['慢速', '中速', '快速'] as const;

export type DialogueRole = (typeof DIALOGUE_ROLES)[number];
export type DialogueEmotion = (typeof DIALOGUE_EMOTIONS)[number];
export type DialogueSpeed = (typeof DIALOGUE_SPEEDS)[number];

export interface Dialogue {
  id: string;
  role: DialogueRole;
  content: string;
  emotion?: DialogueEmotion;
  speed?: DialogueSpeed;
  audioPath?: string;
}

export interface Slide {
  id: string;
  type: SlideType;
  title: string;
  description: string;
  content?: string;
  imagePath?: string;
  audioPath?: string;
  dialogues?: Dialogue[];
}

export interface PPTPlan {
  slides: Slide[];
}

export function moveSlideUp(slides: Slide[], index: number): Slide[] {
  if (index <= 0 || index >= slides.length) return slides;
  const newSlides = [...slides];
  const temp = newSlides[index];
  newSlides[index] = newSlides[index - 1];
  newSlides[index - 1] = temp;
  return newSlides;
}

export function moveSlideDown(slides: Slide[], index: number): Slide[] {
  if (index < 0 || index >= slides.length - 1) return slides;
  const newSlides = [...slides];
  const temp = newSlides[index];
  newSlides[index] = newSlides[index + 1];
  newSlides[index + 1] = temp;
  return newSlides;
}

export interface ChatRecord {
  id: string; // project_id
  userId?: string; // default 'admin'
  title: string; // project_name
  createdAt: number;
  updatedAt?: number;
  messages: any[]; // chat_messages
  videoPath?: string; // video_path
  pptPlan?: PPTPlan;
}
