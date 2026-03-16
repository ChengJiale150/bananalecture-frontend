import { NextRequest, NextResponse } from 'next/server';
import { deleteChat, getAllChats, getChat, upsertChat } from '@/lib/chat-store-server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const chat = await getChat(id);
      if (chat) {
        return NextResponse.json(chat);
      }
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    const chats = await getAllChats();
    return NextResponse.json(chats);
  } catch (error) {
    console.error('GET /api/history error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const update = await request.json();
    if (!update?.id) {
      return NextResponse.json({ error: 'Invalid chat data: missing id' }, { status: 400 });
    }

    const chat = await upsertChat(update);
    return NextResponse.json({ success: true, chat });
  } catch (error) {
    console.error('POST /api/history error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    await deleteChat(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/history error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
