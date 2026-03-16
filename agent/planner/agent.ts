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
3. **特别注意**：每个页面的 \`content\` 字段必须是详细的图片画面描述提示词。

## 图片描述提示词规范 (Content 字段)
请严格遵循以下标准编写 \`content\` 字段：

1. **用自然语言清晰描述画面**
   - 建议用简洁连贯的自然语言写明 **主体 + 行为 + 环境**
   - 若对画面美学有要求，可用自然语言或短语补充 **风格、色彩、光影、构图** 等美学元素

2. **明确应用场景和用途**
   - 推荐在文本提示中写明图像用途和类型

3. **提高文本渲染准确度**
   - 建议将要生成的 **文字内容** 放在 **双引号** 中

### 优秀提示词示例
"冰箱打开的内部视图：上层: 左边放着一盒牛奶，牛奶盒上绘制了三只大小不一的奶牛，在草原上吃草，右边是一个鸡蛋支架，里面放着八个鸡蛋。中层: 一个盘子，里面装着吃剩的烤鸡，烤鸡上插着一个红色的小旗帜，旁边是一个装满草莓的透明保鲜盒，盒子上绘制有菠萝、草莓和橙子的图案。 下层: 蔬菜抽屉里有生菜、胡萝卜和西红柿。冰箱门后面的置物架里放着番茄酱和蛋黄酱。"

## 标准PPT结构（必须包含）

1. **封面页 (cover)**
   - 标题：醒目的标题
   - 描述：生动有趣的介绍性文字
   - 画面描述 (content)：哆啦A梦和大雄的可爱插图，包含标题文字 "标题内容"

2. **引入页 (introduction)**
   - 标题：引入主题
   - 描述：大雄遇到问题的场景或哆啦A梦拿出道具
   - 画面描述 (content)：大雄苦恼的表情或哆啦A梦展示道具的特写

3. **正文页 (content)** - 可以有多页
   - 标题：知识点标题
   - 描述：深入浅出地讲解知识点，包含对话概要
   - 画面描述 (content)：具体的教学场景，黑板、道具演示或想象画面，包含关键文字

4. **总结页 (summary)**
   - 标题：总结
   - 描述：简洁明了的要点梳理
   - 画面描述 (content)：大雄的笔记本特写，上面写着重点回顾

5. **结束页 (ending)**
   - 标题：结束语
   - 描述：鼓励继续学习的话语
   - 画面描述 (content)：哆啦A梦和大雄挥手告别，背景温馨

## 创作风格要求
- **生动有趣**：充满童趣和幽默感
- **角色鲜明**：大雄有点迷糊但努力学习，哆啦A梦聪明可靠又乐于助人
- **画面感强**：\`content\` 字段必须是画面描述，不是对话脚本
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
${slide.content ? `**画面描述**: ${slide.content}` : ''}

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
