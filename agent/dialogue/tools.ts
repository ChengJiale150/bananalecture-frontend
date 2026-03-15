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

export function createDialogueTools(chatId: string) {
  const createDialogueScriptTool = tool({
    description: '为当前指定PPT页生成结构化口播稿对话，并持久化保存。',
    inputSchema: z.object({
      slideId: z.string().optional().describe('目标页ID'),
      slideIndex: z.number().int().nonnegative().optional().describe('目标页索引（从0开始）'),
      dialogues: z.array(DialogueSchema).min(1).describe('当前页完整口播稿对话'),
    }),
    async execute({ slideId, slideIndex, dialogues }) {
      const saved = await replaceSlideDialogues(chatId, {
        slideId,
        slideIndex,
        dialogues,
      });

      if (!saved) {
        return {
          result: '未找到目标页，口播稿保存失败。',
          slideId,
          slideIndex,
          dialogues,
        };
      }

      return {
        result: '口播稿生成并保存成功！',
        slideId,
        slideIndex,
        dialogues,
        pptPlan: saved.pptPlan,
      };
    },
  });

  return {
    create_dialogue_script: createDialogueScriptTool,
  };
}
