import db from './db';
import { ChatRecord, Slide, Dialogue } from './chat-store';
import { v4 as uuidv4 } from 'uuid';

const roleSet = new Set(['大雄', '哆啦A梦', '旁白', '其他男声', '其他女声', '道具']);
const emotionSet = new Set(['开心的', '悲伤的', '生气的', '害怕的', '惊讶的', '无明显情感']);
const speedSet = new Set(['慢速', '中速', '快速']);

function normalizeDialogueRole(value: unknown): Dialogue['role'] {
  if (typeof value === 'string' && roleSet.has(value)) {
    return value as Dialogue['role'];
  }
  return '旁白';
}

function normalizeDialogueEmotion(value: unknown): Dialogue['emotion'] {
  if (typeof value === 'string' && emotionSet.has(value)) {
    return value as Dialogue['emotion'];
  }
  return '无明显情感';
}

function normalizeDialogueSpeed(value: unknown): Dialogue['speed'] {
  if (typeof value === 'string' && speedSet.has(value)) {
    return value as Dialogue['speed'];
  }
  if (typeof value === 'number') {
    if (value <= 0.9) return '慢速';
    if (value >= 1.2) return '快速';
    return '中速';
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (!Number.isNaN(parsed)) {
      if (parsed <= 0.9) return '慢速';
      if (parsed >= 1.2) return '快速';
      return '中速';
    }
  }
  return '中速';
}

// Helper to parse JSON safely
function parseJSON<T>(text: string | null, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

// Helper to reconstruct ChatRecord from DB rows
function getChatSync(id: string): ChatRecord | null {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
  if (!project) return null;

  // Get slides
  const slidesRows = db.prepare('SELECT * FROM ppt_plans WHERE project_id = ? ORDER BY idx ASC').all(id) as any[];
  
  const slides: Slide[] = slidesRows.map(row => {
    // Get dialogues for this slide
    const dialoguesRows = db.prepare('SELECT * FROM dialogues WHERE plan_id = ? ORDER BY idx ASC').all(row.id) as any[];
    
    const dialogues: Dialogue[] = dialoguesRows.map(dRow => ({
      id: dRow.id,
      role: normalizeDialogueRole(dRow.role),
      content: dRow.content,
      emotion: normalizeDialogueEmotion(dRow.emotion),
      speed: normalizeDialogueSpeed(dRow.speed),
      audioPath: dRow.audio_path
    }));

    return {
      id: row.id,
      type: row.type,
      title: row.title,
      description: row.description,
      content: row.content,
      imagePath: row.image_path,
      audioPath: row.audio_path,
      dialogues
    };
  });

  return {
    id: project.id,
    userId: project.user_id,
    title: project.name,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    messages: parseJSON(project.messages, []),
    videoPath: project.video_path,
    pptPlan: slides.length > 0 ? { slides } : undefined
  };
}

export async function getAllChats(): Promise<ChatRecord[]> {
  const rows = db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all() as any[];
  return rows.map(project => ({
    id: project.id,
    userId: project.user_id,
    title: project.name,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    messages: parseJSON(project.messages, []),
    videoPath: project.video_path,
    pptPlan: undefined 
  }));
}

export async function getChat(id: string): Promise<ChatRecord | null> {
  return getChatSync(id);
}

export async function upsertChat(update: Partial<ChatRecord> & { id: string }): Promise<ChatRecord> {
  const { id } = update;
  const now = Date.now();

  const transaction = db.transaction(() => {
    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;

    if (existing) {
      // Update
      const newTitle = update.title ?? existing.name;
      const newMessages = 'messages' in update ? JSON.stringify(update.messages) : existing.messages;
      const newVideoPath = 'videoPath' in update ? update.videoPath : existing.video_path;

      db.prepare(`
        UPDATE projects 
        SET name = ?, messages = ?, video_path = ?, updated_at = ?
        WHERE id = ?
      `).run(newTitle, newMessages, newVideoPath, now, id);

      if ('pptPlan' in update) {
        // Replace plans
        db.prepare('DELETE FROM ppt_plans WHERE project_id = ?').run(id);

        if (update.pptPlan && update.pptPlan.slides) {
          const mergedSlides = mergeSlidesWithExistingDialogues(id, update.pptPlan.slides);
          insertSlides(id, mergedSlides, now);
        }
      }

    } else {
      // Insert
      const title = update.title || 'New Chat';
      // If title is 'New Chat', try to extract from messages like before
      let finalTitle = title;
      if (finalTitle === 'New Chat' && update.messages && update.messages.length > 0) {
         const firstText = (update.messages[0] as any)?.content || (update.messages[0] as any)?.parts?.find((p: any) => p.type === 'text')?.text;
         if (typeof firstText === 'string' && firstText.trim()) {
            finalTitle = firstText.slice(0, 30);
         }
      }

      db.prepare(`
        INSERT INTO projects (id, user_id, name, messages, video_path, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        update.userId || 'admin',
        finalTitle,
        JSON.stringify(update.messages || []),
        update.videoPath || null,
        update.createdAt || now,
        now
      );

      if (update.pptPlan && update.pptPlan.slides) {
        insertSlides(id, update.pptPlan.slides, now);
      }
    }

    return getChatSync(id)!;
  });

  return transaction();
}

function insertSlides(projectId: string, slides: Slide[], now: number) {
  const insertPlan = db.prepare(`
    INSERT INTO ppt_plans (id, project_id, type, title, description, content, idx, image_path, audio_path, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertDialogue = db.prepare(`
    INSERT INTO dialogues (id, plan_id, role, content, emotion, speed, idx, audio_path, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  slides.forEach((slide, idx) => {
    const slideId = slide.id || uuidv4();
    insertPlan.run(
      slideId,
      projectId,
      slide.type,
      slide.title,
      slide.description,
      slide.content || '',
      idx,
      slide.imagePath || null,
      slide.audioPath || null,
      now,
      now
    );

    if (slide.dialogues) {
      slide.dialogues.forEach((d, dIdx) => {
        const dId = d.id || uuidv4();
        insertDialogue.run(
          dId,
          slideId,
          normalizeDialogueRole(d.role),
          d.content,
          normalizeDialogueEmotion(d.emotion),
          normalizeDialogueSpeed(d.speed),
          dIdx,
          d.audioPath || null,
          now,
          now
        );
      });
    }
  });
}

function mergeSlidesWithExistingDialogues(projectId: string, slides: Slide[]) {
  const existingSlides = getChatSync(projectId)?.pptPlan?.slides || [];
  if (existingSlides.length === 0) {
    return slides;
  }

  const existingById = new Map(existingSlides.map(slide => [slide.id, slide]));

  return slides.map((slide, idx) => {
    if (slide.dialogues && slide.dialogues.length > 0) {
      return slide;
    }

    const matchedById = slide.id ? existingById.get(slide.id) : undefined;
    if (matchedById?.dialogues && matchedById.dialogues.length > 0) {
      return {
        ...slide,
        dialogues: matchedById.dialogues,
      };
    }

    const matchedByIndex = existingSlides[idx];
    if (matchedByIndex?.dialogues && matchedByIndex.dialogues.length > 0) {
      return {
        ...slide,
        dialogues: matchedByIndex.dialogues,
      };
    }

    return slide;
  });
}

export async function mutateChat<T>(
  id: string,
  mutator: (chat: ChatRecord) => { result: T; chat?: ChatRecord },
): Promise<T> {
  // Use transaction to ensure atomicity
  const transaction = db.transaction(() => {
    const existing = getChatSync(id);
    const now = Date.now();
    
    const chatToMutate = existing || {
      id,
      userId: 'admin',
      title: 'New Chat',
      createdAt: now,
      updatedAt: now,
      messages: [],
    } as ChatRecord;

    const { result, chat: next } = mutator(chatToMutate);

    if (next) {
       const existingRecord = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
       
       if (existingRecord) {
         // Update
         db.prepare(`
            UPDATE projects 
            SET name = ?, messages = ?, video_path = ?, updated_at = ?
            WHERE id = ?
         `).run(
            next.title, 
            JSON.stringify(next.messages), 
            next.videoPath || null,
            now,
            id
         );
         
         if (next.pptPlan) {
            db.prepare('DELETE FROM ppt_plans WHERE project_id = ?').run(id);
            if (next.pptPlan.slides) {
              const mergedSlides = mergeSlidesWithExistingDialogues(id, next.pptPlan.slides);
              insertSlides(id, mergedSlides, now);
            }
         }
       } else {
         // Insert
         db.prepare(`
            INSERT INTO projects (id, user_id, name, messages, video_path, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            id,
            next.userId || 'admin',
            next.title,
            JSON.stringify(next.messages || []),
            next.videoPath || null,
            next.createdAt || now,
            now
          );

          if (next.pptPlan && next.pptPlan.slides) {
            insertSlides(id, next.pptPlan.slides, now);
          }
       }
    }

    return result;
  });

  return transaction();
}

export async function replaceSlideDialogues(
  chatId: string,
  payload: { slideId?: string; slideIndex?: number; dialogues: Omit<Dialogue, 'id'>[] },
) {
  const transaction = db.transaction(() => {
    const now = Date.now();
    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(chatId) as any;

    if (!existing) {
      return null;
    }
    db.prepare(`
      UPDATE projects
      SET updated_at = ?
      WHERE id = ?
    `).run(now, chatId);

    let targetPlan = null as any;
    if (payload.slideId) {
      targetPlan = db
        .prepare('SELECT * FROM ppt_plans WHERE project_id = ? AND id = ?')
        .get(chatId, payload.slideId) as any;
    }
    if (!targetPlan && typeof payload.slideIndex === 'number') {
      targetPlan = db
        .prepare('SELECT * FROM ppt_plans WHERE project_id = ? ORDER BY idx ASC LIMIT 1 OFFSET ?')
        .get(chatId, payload.slideIndex) as any;
    }
    if (!targetPlan) {
      return null;
    }

    db.prepare('DELETE FROM dialogues WHERE plan_id = ?').run(targetPlan.id);

    const insertDialogue = db.prepare(`
      INSERT INTO dialogues (id, plan_id, role, content, emotion, speed, idx, audio_path, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    payload.dialogues.forEach((d, dIdx) => {
      insertDialogue.run(
        uuidv4(),
        targetPlan.id,
        normalizeDialogueRole(d.role),
        d.content,
        normalizeDialogueEmotion(d.emotion),
        normalizeDialogueSpeed(d.speed),
        dIdx,
        d.audioPath || null,
        now,
        now,
      );
    });

    return targetPlan.id as string;
  });

  const targetSlideId = transaction();
  if (!targetSlideId) {
    return null;
  }
  return getChatSync(chatId);
}

export async function deleteChat(id: string) {
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
}
