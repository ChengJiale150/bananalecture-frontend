import { NextRequest, NextResponse } from 'next/server';
import { deleteChat, getAllChats, getChat, upsertChat } from '@/lib/chat-store-server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (id) {
    const chat = await getChat(id);
    if (chat) {
      return NextResponse.json(chat);
    }
    return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
  }

  // Return list with minimal info (maybe exclude messages for list view to save bandwidth, but for now simple is fine)
  const chats = await getAllChats();
  return NextResponse.json(chats);
}

export async function POST(request: NextRequest) {
  const update = await request.json();
  if (!update?.id) {
    return NextResponse.json({ error: 'Invalid chat data: missing id' }, { status: 400 });
  }

  const chat = await upsertChat(update);
  return NextResponse.json({ success: true, chat });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  await deleteChat(id);

  return NextResponse.json({ success: true });
}
