export type SlideType = 'cover' | 'introduction' | 'content' | 'summary' | 'ending';

export interface Slide {
  type: SlideType;
  title: string;
  description: string;
  content?: string;
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

export type GraphNodeStatus = 'in_progress' | 'pending' | 'completed';

export interface GraphNode {
  task: string;
  dependencies: string[];
  status: GraphNodeStatus;
}

export interface SubAgentRecord {
  name: string;
  system_prompt: string;
}

export interface ChatRecord {
  id: string;
  title: string;
  createdAt: number;
  messages: any[];
  subAgents?: SubAgentRecord[];
  graph?: GraphNode[];
  pptPlan?: PPTPlan;
}
