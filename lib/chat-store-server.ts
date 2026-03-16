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
function getChatSync(id: string, includeDialogues: boolean = false): ChatRecord | null {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
  if (!project) return null;

  // Get slides
  const slidesRows = db.prepare('SELECT * FROM ppt_plans WHERE project_id = ? ORDER BY idx ASC').all(id) as any[];
  
  const slides: Slide[] = slidesRows.map(row => {
    let dialogues: Dialogue[] | undefined = undefined;

    if (includeDialogues) {
      const dialoguesRows = db.prepare('SELECT * FROM dialogues WHERE plan_id = ? ORDER BY idx ASC').all(row.id) as any[];
      dialogues = dialoguesRows.map(dRow => ({
        id: dRow.id,
        role: normalizeDialogueRole(dRow.role),
        content: dRow.content,
        emotion: normalizeDialogueEmotion(dRow.emotion),
        speed: normalizeDialogueSpeed(dRow.speed),
        audioPath: dRow.audio_path
      }));
    }

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
  return getChatSync(id); // default includeDialogues = false
}

export async function getSlideDialogues(slideId: string): Promise<Dialogue[]> {
  const dialoguesRows = db.prepare('SELECT * FROM dialogues WHERE plan_id = ? ORDER BY idx ASC').all(slideId) as any[];
  return dialoguesRows.map(dRow => ({
    id: dRow.id,
    role: normalizeDialogueRole(dRow.role),
    content: dRow.content,
    emotion: normalizeDialogueEmotion(dRow.emotion),
    speed: normalizeDialogueSpeed(dRow.speed),
    audioPath: dRow.audio_path
  }));
}

export async function upsertChat(update: Partial<ChatRecord> & { id: string }): Promise<ChatRecord> {
  const { id: projectId } = update;
  const now = Date.now();

  const transaction = db.transaction(() => {
    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as any;

    if (existing) {
      // Update
      const newTitle = update.title ?? existing.name;
      const newMessages = 'messages' in update ? JSON.stringify(update.messages) : existing.messages;
      const newVideoPath = 'videoPath' in update ? update.videoPath : existing.video_path;

      db.prepare(`
        UPDATE projects 
        SET name = ?, messages = ?, video_path = ?, updated_at = ?
        WHERE id = ?
      `).run(newTitle, newMessages, newVideoPath, now, projectId);

      if ('pptPlan' in update) {
        if (update.pptPlan && update.pptPlan.slides) {
          syncSlides(projectId, update.pptPlan.slides, now);
        } else {
          db.prepare('DELETE FROM ppt_plans WHERE project_id = ?').run(projectId);
        }
      }

    } else {
      // Insert
      const title = update.title || 'New Project';
      // If title is 'New Project', try to extract from messages like before
      let finalTitle = title;
      if (finalTitle === 'New Project' && update.messages && update.messages.length > 0) {
         const firstText = (update.messages[0] as any)?.content || (update.messages[0] as any)?.parts?.find((p: any) => p.type === 'text')?.text;
         if (typeof firstText === 'string' && firstText.trim()) {
            finalTitle = firstText.slice(0, 30);
         }
      }

      db.prepare(`
        INSERT INTO projects (id, user_id, name, messages, video_path, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        projectId,
        update.userId || 'admin',
        finalTitle,
        JSON.stringify(update.messages || []),
        update.videoPath || null,
        update.createdAt || now,
        now
      );

      if (update.pptPlan && update.pptPlan.slides) {
        insertSlides(projectId, update.pptPlan.slides, now);
      }
    }

    return getChatSync(projectId)!;
  });

  return transaction();
}

function syncSlides(projectId: string, slides: Slide[], now: number) {
  const existingRows = db.prepare('SELECT id FROM ppt_plans WHERE project_id = ?').all(projectId) as {id: string}[];
  const existingIds = new Set(existingRows.map(r => r.id));
  const newIds = new Set(slides.map(s => s.id).filter(Boolean));

  for (const id of existingIds) {
    if (!newIds.has(id)) {
      db.prepare('DELETE FROM ppt_plans WHERE id = ?').run(id);
    }
  }

  const insertPlan = db.prepare(`
    INSERT INTO ppt_plans (id, project_id, type, title, description, content, idx, image_path, audio_path, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const updatePlan = db.prepare(`
    UPDATE ppt_plans
    SET type = ?, title = ?, description = ?, content = ?, idx = ?, image_path = ?, audio_path = ?, updated_at = ?
    WHERE id = ?
  `);

  const insertDialogue = db.prepare(`
    INSERT INTO dialogues (id, plan_id, role, content, emotion, speed, idx, audio_path, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  slides.forEach((slide, idx) => {
    const slideId = slide.id || uuidv4();
    if (existingIds.has(slideId)) {
      updatePlan.run(
        slide.type,
        slide.title,
        slide.description,
        slide.content || '',
        idx,
        slide.imagePath || null,
        slide.audioPath || null,
        now,
        slideId
      );
    } else {
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

      if (slide.dialogues && slide.dialogues.length > 0) {
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
    }
  });
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

export async function mutateChat<T>(
  projectId: string,
  mutator: (chat: ChatRecord) => { result: T; chat?: ChatRecord },
): Promise<T> {
  // Use transaction to ensure atomicity
  const transaction = db.transaction(() => {
    const existing = getChatSync(projectId);
    const now = Date.now();
    
    const chatToMutate = existing || {
      id: projectId,
      userId: 'admin',
      title: 'New Project',
      createdAt: now,
      updatedAt: now,
      messages: [],
    } as ChatRecord;

    const { result, chat: next } = mutator(chatToMutate);

    if (next) {
       const existingRecord = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as any;
       
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
            projectId
         );
         
         if (next.pptPlan) {
            if (next.pptPlan.slides) {
              syncSlides(projectId, next.pptPlan.slides, now);
            } else {
              db.prepare('DELETE FROM ppt_plans WHERE project_id = ?').run(projectId);
            }
         }
       } else {
         // Insert
         db.prepare(`
            INSERT INTO projects (id, user_id, name, messages, video_path, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            projectId,
            next.userId || 'admin',
            next.title,
            JSON.stringify(next.messages || []),
            next.videoPath || null,
            next.createdAt || now,
            now
          );

          if (next.pptPlan && next.pptPlan.slides) {
            insertSlides(projectId, next.pptPlan.slides, now);
          }
       }
    }

    return result;
  });

  return transaction();
}

export async function clearSlideDialogues(slideId: string): Promise<boolean> {
  try {
    const result = db.prepare('DELETE FROM dialogues WHERE plan_id = ?').run(slideId);
    return result.changes >= 0;
  } catch (error) {
    console.error('Failed to clear slide dialogues:', error);
    return false;
  }
}

export async function replaceSlideDialogues(
  projectId: string,
  target: { slideId?: string; slideIndex?: number; dialogues: Dialogue[] },
): Promise<ChatRecord | null> {
  const runTransaction = db.transaction(() => {
    const now = Date.now();
    
    // 1. Validate project exists
    const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
    if (!project) return null;

    // 2. Find target slide
    let targetSlideId = target.slideId;
    
    if (!targetSlideId && typeof target.slideIndex === 'number') {
       const slide = db.prepare('SELECT id FROM ppt_plans WHERE project_id = ? ORDER BY idx ASC LIMIT 1 OFFSET ?').get(projectId, target.slideIndex) as {id: string};
       if (slide) targetSlideId = slide.id;
    }

    if (!targetSlideId) return null;

    // 3. Clear existing dialogues for this slide
    // IMPORTANT: We must clear before inserting to avoid duplication or conflicts
    db.prepare('DELETE FROM dialogues WHERE plan_id = ?').run(targetSlideId);

    // 4. Insert new dialogues
    const insertDialogue = db.prepare(`
      INSERT INTO dialogues (id, plan_id, role, content, emotion, speed, idx, audio_path, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    target.dialogues.forEach((d, idx) => {
      insertDialogue.run(
        d.id || uuidv4(),
        targetSlideId,
        normalizeDialogueRole(d.role),
        d.content,
        normalizeDialogueEmotion(d.emotion),
        normalizeDialogueSpeed(d.speed),
        idx,
        d.audioPath || null,
        now,
        now
      );
    });

    // 5. Update project timestamp
    db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(now, projectId);

    return projectId;
  });

  const result = runTransaction();
  return result ? getChatSync(projectId) : null;
}

export async function deleteChat(id: string) {
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
}
