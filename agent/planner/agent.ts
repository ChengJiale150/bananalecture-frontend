import { createPlannerTools } from '@/agent/planner/tools';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { ToolLoopAgent, InferAgentUIMessage } from 'ai';
import type { PPTPlan } from '@/lib/chat-store';

const kimiClient = createOpenAICompatible({
  name: 'kimi',
  baseURL: process.env.OPENAI_BASE_URL ?? 'https://api.moonshot.cn/v1',
  apiKey: process.env.OPENAI_API_KEY ?? '',
});

interface PlannerOptions {
  pptPlan?: PPTPlan;
  pageCount?: string;
  audience?: string;
  style?: string;
}

function buildSystemPrompt(options?: PlannerOptions) {
  const { pptPlan: existingPlan, pageCount, audience, style } = options || {};

  let prompt = `
你是一位出色的哆啦A梦教学漫画规划师！你的任务是根据用户的教学内容，创作出生动有趣的哆啦A梦风格教学漫画PPT规划。

# 任务
收到用户的教学内容后，你需要：
1. 深入理解教学内容
2. 使用 \`create_ppt_plan\` 工具创建一个完整的PPT规划
3. 规划必须包含以下标准结构：

## 标准PPT结构（必须包含）

1. **封面页 (cover)**
   - 醒目的标题
   - 哆啦A梦和大雄的可爱插图描述
   - 生动有趣的介绍性文字

2. **引入页 (introduction)**
   - 大雄遇到问题的场景
   - 哆啦A梦拿出神奇道具的情节
   - 引起学生兴趣的悬念

3. **正文页 (content)** - 可以有多页
   - 深入浅出地讲解知识点
   - 包含大雄和哆啦A梦的对话与讨论
   - 用生动有趣的方式解释难点
   - 可以包含举例、比喻、图示等

4. **总结页 (summary)**
   - 大雄的总结笔记
   - 用大雄的口吻回顾重点
   - 简洁明了的要点梳理

5. **结束页 (ending)**
   - 温馨的结束语
   - 鼓励继续学习的话语
   - 哆啦A梦和大雄的可爱告别

## 创作风格要求
- **生动有趣**：充满童趣和幽默感
- **角色鲜明**：大雄有点迷糊但努力学习，哆啦A梦聪明可靠又乐于助人
- **语言简洁**：用简单易懂的语言解释复杂概念
- **画面感强**：每一页都要有清晰的画面描述
`;

  if (pageCount) {
    let pageCountText = pageCount;
    if (pageCount === '15+') pageCountText = '15页以上';
    else if (pageCount === '5-10') pageCountText = '5-10页';
    else if (pageCount === '10-15') pageCountText = '10-15页';
    prompt += `\n- **页数规划**：请规划 ${pageCountText} 的内容。\n`;
  }

  if (audience) {
    let audienceText = audience;
    if (audience === 'beginner') audienceText = '初学者（注重基础，简单易懂）';
    else if (audience === 'intermediate') audienceText = '有基础（适当深入，注重实践）';
    else if (audience === 'expert') audienceText = '精通（专业深度，探讨前沿）';
    prompt += `\n- **目标受众**：${audienceText}。\n`;
  }
  
  if (style && style !== 'doraemon') {
      // Future proofing for other styles if needed, though currently only doraemon is supported fully in prompt text
      prompt += `\n- **风格要求**：${style}风格。\n`;
  }

  if (existingPlan && existingPlan.slides && existingPlan.slides.length > 0) {
    prompt += `

## 已有的PPT规划
用户已经有一个PPT规划，请参考并基于此进行修改、完善或扩展：

`;
    existingPlan.slides.forEach((slide, index) => {
      prompt += `
### 第 ${index + 1} 页 - ${slide.type}
**标题**: ${slide.title}
**描述**: ${slide.description}
${slide.content ? `**内容**: ${slide.content}` : ''}

`;
    });

    prompt += `
请根据用户的新需求，修改或完善这个规划。如果用户没有明确要求修改，请保留现有规划并给出回应。
`;
  } else {
    prompt += `

现在，根据用户的输入，创建一个精彩的哆啦A梦教学漫画PPT规划吧！
`;
  }

  return prompt;
}

export const PlannerAgent = new ToolLoopAgent({
  model: kimiClient(process.env.OPENAI_MODEL ?? 'kimi-k2.5'),
  instructions: buildSystemPrompt(),
  tools: createPlannerTools('__default__'),
});

export type PlannerAgentUIMessage = InferAgentUIMessage<typeof PlannerAgent>;

export function createPlannerAgent(
  chatId: string,
  options?: { autoApprove?: boolean; pptPlan?: PPTPlan; pageCount?: string; audience?: string; style?: string },
) {
  return new ToolLoopAgent({
    model: kimiClient(process.env.OPENAI_MODEL ?? 'kimi-k2.5'),
    instructions: buildSystemPrompt(options),
    tools: createPlannerTools(chatId),
    experimental_context: {
      autoApprove: options?.autoApprove,
      pptPlan: options?.pptPlan,
    },
  });
}
