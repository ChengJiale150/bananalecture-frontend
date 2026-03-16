import { createDialogueAgent } from '@/agent/dialogue/agent';
import { createAgentUIStreamResponse } from 'ai';
import { z } from 'zod';
import { replaceSlideDialogues, getSlideDialogues } from '@/lib/chat-store-server';
import { DIALOGUE_EMOTIONS, DIALOGUE_ROLES, DIALOGUE_SPEEDS } from '@/lib/chat-store';

const ManualDialogueSchema = z.object({
  id: z.string().min(1),
  role: z.enum(DIALOGUE_ROLES),
  content: z.string().min(1),
  emotion: z.enum(DIALOGUE_EMOTIONS).optional(),
  speed: z.enum(DIALOGUE_SPEEDS).optional(),
  audioPath: z.string().optional(),
});

const ManualDialoguePatchSchema = z.object({
  projectId: z.string().min(1),
  slideId: z.string().min(1),
  dialogues: z.array(ManualDialogueSchema),
});

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

export async function PATCH(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const parsed = ManualDialoguePatchSchema.safeParse(payload);

    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { projectId, slideId, dialogues } = parsed.data;
    const saved = await replaceSlideDialogues(
      projectId,
      {
        slideId,
        dialogues,
      },
      'manual_edit_dialogues',
    );

    if (!saved) {
      return Response.json({ error: 'Target slide not found' }, { status: 404 });
    }

    const latestDialogues = await getSlideDialogues(slideId);
    return Response.json({ success: true, dialogues: latestDialogues });
  } catch (error) {
    console.error('PATCH /api/dialogue error:', error);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
