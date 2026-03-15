import { promises as fs } from 'fs';
import path from 'path';
import { ChatRecord } from './chat-store';

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE_PATH = path.join(DATA_DIR, 'chats.json');

let lock: Promise<void> = Promise.resolve();

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const previous = lock;
  let release!: () => void;
  lock = new Promise<void>(resolve => {
    release = resolve;
  });
  await previous;
  try {
    return await fn();
  } finally {
    release();
  }
}

async function ensureData() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(FILE_PATH);
  } catch {
    await fs.writeFile(FILE_PATH, JSON.stringify([]), 'utf-8');
  }
}

async function readChatsUnlocked(): Promise<ChatRecord[]> {
  await ensureData();
  const raw = await fs.readFile(FILE_PATH, 'utf-8');
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChatRecord[]) : [];
  } catch {
    return [];
  }
}

async function writeChatsUnlocked(chats: ChatRecord[]) {
  await ensureData();
  const tmpPath = path.join(DATA_DIR, `chats.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`);
  const payload = JSON.stringify(chats, null, 2);

  const handle = await fs.open(tmpPath, 'w');
  try {
    await handle.writeFile(payload, 'utf-8');
    await handle.sync();
  } finally {
    await handle.close();
  }

  try {
    await fs.rename(tmpPath, FILE_PATH);
  } catch {
    await fs.rm(FILE_PATH, { force: true });
    await fs.rename(tmpPath, FILE_PATH);
  }
}

export async function getAllChats(): Promise<ChatRecord[]> {
  return withLock(async () => readChatsUnlocked());
}

export async function getChat(id: string): Promise<ChatRecord | null> {
  return withLock(async () => {
    const chats = await readChatsUnlocked();
    return chats.find(c => c.id === id) ?? null;
  });
}

export async function upsertChat(update: Partial<ChatRecord> & { id: string }): Promise<ChatRecord> {
  return withLock(async () => {
    const chats = await readChatsUnlocked();
    const index = chats.findIndex(c => c.id === update.id);
    const now = Date.now();

    if (index >= 0) {
      const existing = chats[index];
      const merged: ChatRecord = {
        ...existing,
        ...update,
        title: update.title ?? existing.title,
        createdAt: existing.createdAt,
        messages: 'messages' in update ? (update.messages ?? []) : (existing.messages ?? []),
        pptPlan: 'pptPlan' in update ? update.pptPlan : existing.pptPlan,
        graph: 'graph' in update ? update.graph : existing.graph,
        subAgents: 'subAgents' in update ? update.subAgents : existing.subAgents,
      };
      chats[index] = merged;
      await writeChatsUnlocked(chats);
      return merged;
    }

    const created: ChatRecord = {
      id: update.id,
      createdAt: typeof update.createdAt === 'number' ? update.createdAt : now,
      title: update.title ?? 'New Chat',
      messages: update.messages ?? [],
      subAgents: update.subAgents ?? [],
      graph: update.graph ?? [],
      pptPlan: update.pptPlan,
    };
    if (!created.title || created.title === 'New Chat') {
      const firstText = (created.messages?.[0] as any)?.content || (created.messages?.[0] as any)?.parts?.find((p: any) => p.type === 'text')?.text;
      if (typeof firstText === 'string' && firstText.trim()) {
        created.title = firstText.slice(0, 30);
      }
    }

    chats.push(created);
    await writeChatsUnlocked(chats);
    return created;
  });
}

export async function mutateChat<T>(
  id: string,
  mutator: (chat: ChatRecord) => { result: T; chat?: ChatRecord },
): Promise<T> {
  return withLock(async () => {
    const chats = await readChatsUnlocked();
    const index = chats.findIndex(c => c.id === id);
    const now = Date.now();

    const existing: ChatRecord =
      index >= 0
        ? chats[index]
        : {
            id,
            createdAt: now,
            title: 'New Chat',
            messages: [],
            subAgents: [],
            graph: [],
          };

    const { result, chat: next } = mutator(existing);
    if (!next) return result;

    const merged: ChatRecord = {
      ...existing,
      ...next,
      id,
      createdAt: existing.createdAt,
      title: next.title ?? existing.title,
      messages: 'messages' in next ? (next.messages ?? []) : (existing.messages ?? []),
      pptPlan: 'pptPlan' in next ? next.pptPlan : existing.pptPlan,
      graph: 'graph' in next ? next.graph : existing.graph,
      subAgents: 'subAgents' in next ? next.subAgents : existing.subAgents,
    };

    if (index >= 0) chats[index] = merged;
    else chats.push(merged);

    await writeChatsUnlocked(chats);
    return result;
  });
}

export async function deleteChat(id: string) {
  return withLock(async () => {
    const chats = await readChatsUnlocked();
    const next = chats.filter(c => c.id !== id);
    await writeChatsUnlocked(next);
  });
}
