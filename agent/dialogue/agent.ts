import { createDialogueTools } from '@/agent/dialogue/tools';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { ToolLoopAgent, InferAgentUIMessage, hasToolCall } from 'ai';
import type { PPTPlan, Slide, Dialogue } from '@/lib/chat-store';

const kimiClient = createOpenAICompatible({
  name: 'kimi',
  baseURL: process.env.OPENAI_BASE_URL ?? 'https://api.moonshot.cn/v1',
  apiKey: process.env.OPENAI_API_KEY ?? '',
});

interface DialogueAgentOptions {
  pptPlan?: PPTPlan;
  targetSlideId?: string;
  targetSlideIndex?: number;
  targetSlide?: Slide;
  previousDialogues?: Dialogue[];
  autoApprove?: boolean;
}

function formatSlide(slide: Slide, index: number) {
  return `
### 第 ${index + 1} 页 (${slide.type})
标题：${slide.title}
描述：${slide.description}
${slide.content ? `内容：${slide.content}` : ''}
`;
}

function buildSystemPrompt(options?: DialogueAgentOptions) {
  const { pptPlan, targetSlide, targetSlideIndex, previousDialogues } = options || {};
  const roleText = '大雄、哆啦A梦、旁白、其他男声、其他女声、道具';
  let prompt = `
你是一个专业的口播稿生成助手,你需要将提供的PPT规划的特定页的内容转换为生动有趣的对话稿。

要求：
1. 角色可以是${roleText}，确保角色与对话内容严格对齐
2. 内容要简洁明了，适合口头表达
3. 语言要生动有趣，吸引听众
4. 为每个对话项设置合适的情感和语速

注意事项:
1. 所有出现的公式与数学符号均转化为Latex格式,并都用$$包裹,如$$E = m \\\\times c^2$$与$$1-\\\\epsilon$$
2. 道具为特殊role，当且仅当哆啦A梦首次掏出道具时，添加角色为道具内容为道具名称的对话，后续出现时无需重复添加（仅添加一次）,封面页禁止生成道具角色
3. 必须只围绕当前目标页生成，禁止改写或提及其他页对话内容
4. 输出前必须调用 create_dialogue_script 工具保存结构化结果，禁止返回未持久化的最终答案
5. 若调用工具失败，必须基于同一目标页立即重试一次；若仍失败，输出明确失败原因
`;

  if (pptPlan?.slides?.length) {
    prompt += '\n\n## 生成的PPT规划供参考\n';
    pptPlan.slides.forEach((slide, index) => {
      prompt += formatSlide(slide, index);
    });
  }

  if (previousDialogues?.length) {
    prompt += '\n\n## 上一次生成的对话内容\n';
    previousDialogues.forEach((d, index) => {
      prompt += `${index + 1}. [${d.role}] (${d.emotion ?? '无明显情感'} / ${d.speed ?? '中速'}) ${d.content}\n`;
    });
  }

  if (targetSlide) {
    const fallbackIndex = typeof targetSlideIndex === 'number' ? targetSlideIndex : 0;
    prompt += `\n\n## 当前你需要生成的对话部分（重点）\n${formatSlide(targetSlide, fallbackIndex)}`;
  }

  prompt += '\n\n请调用 create_dialogue_script，必须传入 slideId 或 slideIndex，以及 dialogues 完整数组。';
  return prompt;
}

export const DialogueAgent = new ToolLoopAgent({
  model: kimiClient(process.env.OPENAI_MODEL ?? 'kimi-k2.5'),
  instructions: buildSystemPrompt(),
  tools: createDialogueTools('__default__'),
});

export type DialogueAgentUIMessage = InferAgentUIMessage<typeof DialogueAgent>;

export function createDialogueAgent(chatId: string, options?: DialogueAgentOptions) {
  return new ToolLoopAgent({
    model: kimiClient(process.env.OPENAI_MODEL ?? 'kimi-k2.5'),
    instructions: buildSystemPrompt(options),
    tools: createDialogueTools(chatId),
    stopWhen: hasToolCall('create_dialogue_script'),
    providerOptions: {
      kimi: {
        thinking: { type: 'disabled' },
      },
    },
    experimental_context: {
      autoApprove: options?.autoApprove,
      pptPlan: options?.pptPlan,
    },
  });
}
