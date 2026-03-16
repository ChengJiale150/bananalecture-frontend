import { tool } from 'ai';
import { z } from 'zod';
import { replaceSlideDialogues } from '@/lib/chat-store-server';

const DialogueRoleSchema = z.enum(['大雄', '哆啦A梦', '旁白', '其他男声', '其他女声', '道具']);
const DialogueEmotionSchema = z.enum(['开心的', '悲伤的', '生气的', '害怕的', '惊讶的', '无明显情感']);
const DialogueSpeedSchema = z.enum(['慢速', '中速', '快速']);

export const DialogueSchema = z.object({
  role: DialogueRoleSchema.describe('对话角色'),
  content: z.string().min(1).describe('对话具体内容'),
  emotion: DialogueEmotionSchema.describe('对话情绪'),
  speed: DialogueSpeedSchema.describe('语速'),
});

const CreateDialogueScriptInputSchema = z
  .object({
    slideId: z.string().optional().describe('目标页ID'),
    slideIndex: z.number().int().nonnegative().optional().describe('目标页索引（从0开始）'),
    dialogues: z.array(DialogueSchema).min(1).describe('当前页完整口播稿对话'),
  })
  .refine((value) => Boolean(value.slideId) || typeof value.slideIndex === 'number', {
    message: 'slideId 与 slideIndex 至少提供一个',
    path: ['slideId'],
  });

export function createDialogueTools(chatId: string) {
  const createDialogueScriptTool = tool({
    description: '为当前指定PPT页生成结构化口播稿对话，并持久化保存。',
    inputSchema: CreateDialogueScriptInputSchema,
    async execute({ slideId, slideIndex, dialogues }) {
      console.log(`[Tool] create_dialogue_script called for slide ${slideId || slideIndex}`);
      try {
        const saved = await replaceSlideDialogues(
          chatId,
          {
            slideId,
            slideIndex,
            dialogues: dialogues as any,
          },
          'generate_dialogues',
        );

        if (!saved) {
          console.error(`[Tool] Failed to save dialogues for slide ${slideId || slideIndex}`);
          return {
            result: '未找到目标页，口播稿保存失败。',
            slideId,
            slideIndex,
            dialogues,
            count: dialogues.length,
            timestamp: Date.now(),
          };
        }

        console.log(`[Tool] Successfully saved dialogues for slide ${slideId || slideIndex}`);
        return {
          result: '口播稿生成并保存成功！',
          slideId,
          slideIndex,
          dialogues,
          count: dialogues.length,
          timestamp: Date.now(),
          persisted: true,
          projectId: chatId,
          pptPlan: saved.pptPlan,
        };
      }
      catch (error) {
        const reason = error instanceof Error ? error.message : 'unknown error';
        console.error(`[Tool] Failed to save dialogues for slide ${slideId || slideIndex}: ${reason}`);
        return {
          result: `口播稿保存失败: ${reason}`,
          slideId,
          slideIndex,
          dialogues,
          count: dialogues.length,
          timestamp: Date.now(),
          persisted: false,
        };
      }
    },
  });

  return {
    create_dialogue_script: createDialogueScriptTool,
  };
}
