import { NextRequest, NextResponse } from 'next/server';
import { getSlideDialogues } from '@/lib/chat-store-server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slideId = searchParams.get('slideId');

  if (!slideId) {
    return NextResponse.json({ error: 'Missing slideId' }, { status: 400 });
  }

  try {
    const dialogues = await getSlideDialogues(slideId);
    return NextResponse.json(dialogues);
  } catch (error) {
    console.error('Failed to fetch slide dialogues:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
