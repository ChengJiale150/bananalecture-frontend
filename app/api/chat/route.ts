import { createPlannerAgent } from '@/agent/planner/agent';
import { createAgentUIStreamResponse } from 'ai';

export async function POST(request: Request) {
  const url = new URL(request.url);
  const payload = await request.json().catch(() => ({}));
  const messages = payload?.messages ?? [];
  const idFromBody = payload?.id;
  const autoApproveFromBody = payload?.autoApprove;
  const pptPlan = payload?.pptPlan;
  const idFromQuery = url.searchParams.get('id');
  const idFromHeader = request.headers.get('x-chat-id');
  const chatId = (idFromBody || idFromQuery || idFromHeader) as string | null;

  if (!chatId) {
    return Response.json({ error: 'Missing chat id' }, { status: 400 });
  }

  const autoApproveFromEnv =
    String(process.env.AUTO_APPROVE ?? '').toLowerCase() === 'true';
  const autoApprove = autoApproveFromEnv || autoApproveFromBody === true;

  return createAgentUIStreamResponse({
    agent: createPlannerAgent(chatId, { autoApprove, pptPlan }),
    uiMessages: messages,
  });
}
