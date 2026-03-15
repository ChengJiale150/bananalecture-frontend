import { tool } from 'ai';
import { z } from 'zod';
import { mutateChat } from '@/lib/chat-store-server';
import type { Slide, SlideType as ChatStoreSlideType } from '@/lib/chat-store';
import { v4 as uuidv4 } from 'uuid';

export const SlideSchema = z.object({
  type: z.enum(['cover', 'introduction', 'content', 'summary', 'ending']).describe('Type of the slide'),
  title: z.string().describe('Title of the slide'),
  description: z.string().describe('Brief description of what this slide is about'),
  content: z.string().optional().describe('Detailed content for the slide'),
});

export type SlideType = z.infer<typeof SlideSchema>['type'];

export function createPlannerTools(chatId: string) {
  const createPPTPlanTool = tool({
    description: 'Create a teaching comic plan for Doraemon-style PPT slides. Create a vivid and fun educational manga plan including cover, introduction, content with Doraemon and Nobita dialogues, summary, and ending page.',
    inputSchema: z.object({
      slides: z.array(SlideSchema).describe('Array of slides for the PPT plan'),
    }),
    async execute({ slides }) {
      if (!slides || slides.length === 0) {
        return mutateChat(chatId, chat => ({
          result: 'PPT Plan Cleared.',
          chat: { ...chat, pptPlan: undefined },
        }));
      }

      return mutateChat(chatId, chat => {
        const validatedSlides: Slide[] = slides.map(slide => ({
          id: uuidv4(),
          type: slide.type as ChatStoreSlideType,
          title: slide.title,
          description: slide.description,
          content: slide.content,
        }));

        return { 
          result: 'PPT Plan Created Successfully!', 
          slides: validatedSlides,
          chat: { ...chat, pptPlan: { slides: validatedSlides } } 
        };
      });
    },
  });

  return {
    create_ppt_plan: createPPTPlanTool,
  };
}
