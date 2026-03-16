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

const STYLE_CONFIG: Record<string, {
  name: string;
  role: string;
  description: string;
  visualPrompt: string;
  structure: string;
}> = {
  multi_panel: {
    name: '多格动漫',
    role: '多格动漫教学漫画规划师',
    description: '注重叙事节奏的多格漫画风格',
    visualPrompt: '哆啦A梦和大雄的多格漫画分镜风格，画面分割清晰，人物动作夸张生动，背景细节丰富，具有强烈的动态感',
    structure: `
1. **封面页 (cover)**
   - 标题：醒目的标题
   - 描述：引人入胜的开场白
   - 画面描述 (content)：哆啦A梦和大雄的漫画风格封面插图，包含标题文字 "标题内容"

2. **引入页 (introduction)**
   - 标题：引入主题
   - 描述：通过多格分镜展示问题场景
   - 画面描述 (content)：哆啦A梦和大雄的多格分镜，展示角色遇到困难的过程，表情生动夸张

3. **正文页 (content)** - 可以有多页
   - 标题：知识点标题
   - 描述：利用分镜逐步拆解知识点
   - 画面描述 (content)：哆啦A梦和大雄的多格分镜，展示教学过程，每格画面重点突出，包含关键文字说明

4. **总结页 (summary)**
   - 标题：总结
   - 描述：回顾关键步骤
   - 画面描述 (content)：哆啦A梦和大雄的多格分镜，展示知识点回顾，清晰明了

5. **结束页 (ending)**
   - 标题：结束语
   - 描述：幽默或温馨的结尾
   - 画面描述 (content)：哆啦A梦和大雄的多格分镜，展示故事结局，角色互动有趣
`
  },
  colorful_comic: {
    name: '彩色漫画',
    role: '彩色漫画教学漫画规划师',
    description: '色彩丰富饱满的现代漫画风格',
    visualPrompt: '哆啦A梦和大雄的彩色漫画风格，色彩鲜艳丰富，高饱和度，现代彩色漫画风格，光影效果强烈，构图大胆',
    structure: `
1. **封面页 (cover)**
   - 标题：醒目的标题
   - 描述：充满视觉冲击力的介绍
   - 画面描述 (content)：哆啦A梦和大雄的色彩绚丽漫画封面，构图大胆，包含标题文字 "标题内容"

2. **引入页 (introduction)**
   - 标题：引入主题
   - 描述：通过色彩和构图营造氛围
   - 画面描述 (content)：哆啦A梦和大雄的色彩鲜明场景，突出角色的情绪和环境氛围

3. **正文页 (content)** - 可以有多页
   - 标题：知识点标题
   - 描述：图文并茂的知识讲解
   - 画面描述 (content)：哆啦A梦和大雄的色彩丰富教学场景，利用颜色区分重点，画面生动

4. **总结页 (summary)**
   - 标题：总结
   - 描述：视觉化的知识梳理
   - 画面描述 (content)：哆啦A梦和大雄的色彩明快总结图表或插图，重点突出

5. **结束页 (ending)**
   - 标题：结束语
   - 描述：令人印象深刻的结尾
   - 画面描述 (content)：哆啦A梦和大雄的色彩温馨或震撼结尾画面，留下深刻印象
`
  },
  flat: {
    name: '扁平插画',
    role: '扁平插画教学漫画规划师',
    description: '简约现代的扁平化设计风格',
    visualPrompt: '哆啦A梦和大雄的现代扁平化插画风格(Flat Illustration)，几何图形为主，色彩搭配和谐，无多余细节，抽象而富有寓意',
    structure: `
1. **封面页 (cover)**
   - 标题：醒目的标题
   - 描述：简洁有力的介绍
   - 画面描述 (content)：哆啦A梦和大雄的简约扁平化封面设计，几何元素构成，包含标题文字 "标题内容"

2. **引入页 (introduction)**
   - 标题：引入主题
   - 描述：用简单的图形表达问题
   - 画面描述 (content)：哆啦A梦和大雄的扁平化风格场景，用抽象图形代表问题或挑战

3. **正文页 (content)** - 可以有多页
   - 标题：知识点标题
   - 描述：逻辑清晰的图形化讲解
   - 画面描述 (content)：哆啦A梦和大雄的扁平化图解，利用图标和几何形状解释概念，清晰直观

4. **总结页 (summary)**
   - 标题：总结
   - 描述：结构化的知识回顾
   - 画面描述 (content)：哆啦A梦和大雄的扁平化风格思维导图或清单，整洁有序

5. **结束页 (ending)**
   - 标题：结束语
   - 描述：简洁的结束语
   - 画面描述 (content)：哆啦A梦和大雄的简约扁平化结尾画面，色彩柔和
`
  }
};

function buildSystemPrompt(options?: PlannerOptions) {
  const { pptPlan: existingPlan, pageCount, audience, style = 'multi_panel' } = options || {};
  
  const currentStyle = STYLE_CONFIG[style] || STYLE_CONFIG['multi_panel'];

  let prompt = `
你是一位出色的${currentStyle.role}！你的任务是根据用户的教学内容，创作出生动有趣的${currentStyle.name}风格教学漫画PPT规划。

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
   - **风格强调**：必须在每张图片的描述中明确包含以下风格关键词：**${currentStyle.visualPrompt}**

2. **提高文本渲染准确度**
   - 建议将要生成的 **文字内容** 放在 **双引号** 中
   - **文本强调**：必须在每张图片的描述中明确包含以下文本关键词：**要求所有的对话使用中文而不是日文**

## 标准PPT结构（必须包含）
${currentStyle.structure}

## 创作风格要求
- **生动有趣**：充满童趣和幽默感
- **风格统一**：确保所有页面都符合 **${currentStyle.name}** 的风格设定
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
  
  // Explicitly reiterate the style requirement
  prompt += `\n- **风格要求**：${currentStyle.visualPrompt}。\n`;

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

现在，根据用户的输入，创建一个精彩的${currentStyle.name}教学漫画PPT规划吧！
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
