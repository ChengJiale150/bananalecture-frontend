import { NextRequest, NextResponse } from 'next/server';
import { clearSlideDialogues } from '@/lib/chat-store-server';

export async function POST(request: NextRequest) {
  try {
    const { slideId } = await request.json();

    if (!slideId) {
      return NextResponse.json({ error: 'Missing slideId' }, { status: 400 });
    }

    const success = await clearSlideDialogues(slideId);
    
    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Failed to clear dialogues' }, { status: 500 });
    }
  } catch (error) {
    console.error('Failed to clear slide dialogues:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
