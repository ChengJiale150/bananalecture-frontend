import {
  DIALOGUE_EMOTIONS,
  DIALOGUE_ROLES,
  DIALOGUE_SPEEDS,
  SLIDE_TYPES,
} from '@/shared/api/banana/types';

export { DIALOGUE_EMOTIONS, DIALOGUE_ROLES, DIALOGUE_SPEEDS, SLIDE_TYPES };

export type SlideType = (typeof SLIDE_TYPES)[number];
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
  const nextSlides = [...slides];
  const current = nextSlides[index];
  nextSlides[index] = nextSlides[index - 1];
  nextSlides[index - 1] = current;
  return nextSlides;
}

export function moveSlideDown(slides: Slide[], index: number): Slide[] {
  if (index < 0 || index >= slides.length - 1) return slides;
  const nextSlides = [...slides];
  const current = nextSlides[index];
  nextSlides[index] = nextSlides[index + 1];
  nextSlides[index + 1] = current;
  return nextSlides;
}

export interface ProjectSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectListPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ProjectListPage {
  items: ProjectSummary[];
  pagination: ProjectListPagination;
}

export interface ProjectRecord extends ProjectSummary {
  userId: string;
  messages: unknown[];
  videoPath?: string;
  pptPlan?: PPTPlan;
}

export interface TaskProgress {
  id: string;
  projectId: string;
  type: string;
  status: string;
  currentStep: number;
  totalSteps: number;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}
