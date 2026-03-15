import { createDialogueAgent } from '@/agent/dialogue/agent';
import { createAgentUIStreamResponse } from 'ai';

export async function POST(request: Request) {
  const url = new URL(request.url);
  const payload = await request.json().catch(() => ({}));
  const messages = payload?.messages ?? [];
  const pptPlan = payload?.pptPlan;
  const idFromBody = payload?.id;
  const targetSlideId = payload?.targetSlideId;
  const targetSlideIndex =
    typeof payload?.targetSlideIndex === 'number' ? payload.targetSlideIndex : undefined;
  const previousDialogues = payload?.previousDialogues;
  const autoApproveFromBody = payload?.autoApprove;
  const idFromQuery = url.searchParams.get('id');
  const idFromHeader = request.headers.get('x-chat-id');
  const chatId = (idFromBody || idFromQuery || idFromHeader) as string | null;

  if (!chatId) {
    return Response.json({ error: 'Missing chat id' }, { status: 400 });
  }

  const targetSlide = Array.isArray(pptPlan?.slides)
    ? pptPlan.slides.find((slide: any, idx: number) => {
        if (targetSlideId) return slide?.id === targetSlideId;
        if (typeof targetSlideIndex === 'number') return idx === targetSlideIndex;
        return false;
      })
    : undefined;

  const autoApproveFromEnv = String(process.env.AUTO_APPROVE ?? '').toLowerCase() === 'true';
  const autoApprove = autoApproveFromEnv || autoApproveFromBody === true;

  return createAgentUIStreamResponse({
    agent: createDialogueAgent(chatId, {
      pptPlan,
      targetSlideId,
      targetSlideIndex,
      targetSlide,
      previousDialogues,
      autoApprove,
    }),
    uiMessages: messages,
  });
}
