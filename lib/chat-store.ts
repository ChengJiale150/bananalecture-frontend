export type SlideType = 'cover' | 'introduction' | 'content' | 'summary' | 'ending';

export interface Dialogue {
  id: string;
  role: string;
  content: string;
  emotion?: string;
  speed?: number;
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
