import db from '../db';
import { ChatRecord, Slide, Dialogue } from '../chat-store';
import { v4 as uuidv4 } from 'uuid';
import {
  normalizeDialogueRole,
  normalizeDialogueEmotion,
  normalizeDialogueSpeed,
  assertDialogueWriteAction,
  type DialogueWriteAction,
} from './utils';
import { getChatSync } from './queries';

type SyncSlidesOptions = {
  includeDialogues?: boolean;
};

function logDialogueWriteEvent(params: {
  scope: string;
  action: unknown;
  projectId: string;
  slideId?: string;
  success: boolean;
  reason?: string;
}) {
  const { scope, action, projectId, slideId, success, reason } = params;
  const payload = { action, projectId, slideId: slideId ?? null, success, reason: reason ?? null };
  if (success) {
    console.log(`[DialogueWrite][${scope}]`, payload);
    return;
  }
  console.error(`[DialogueWrite][${scope}]`, payload);
}

export function syncSlides(projectId: string, slides: Slide[], now: number, options?: SyncSlidesOptions) {
  const includeDialogues = options?.includeDialogues === true;
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

      if (includeDialogues && slide.dialogues && slide.dialogues.length > 0) {
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

export function insertSlides(projectId: string, slides: Slide[], now: number, options?: SyncSlidesOptions) {
  const includeDialogues = options?.includeDialogues === true;
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

    if (includeDialogues && slide.dialogues) {
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
          syncSlides(projectId, update.pptPlan.slides, now, { includeDialogues: false });
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
        insertSlides(projectId, update.pptPlan.slides, now, { includeDialogues: false });
      }
    }

    return getChatSync(projectId)!;
  });

  return transaction();
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
             syncSlides(projectId, next.pptPlan.slides, now, { includeDialogues: false });
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
            insertSlides(projectId, next.pptPlan.slides, now, { includeDialogues: false });
          }
       }
    }

    return result;
  });

  return transaction();
}

export async function clearSlideDialogues(
  slideId: string,
  action: DialogueWriteAction = 'clear_dialogues_for_regen',
): Promise<boolean> {
  try {
    const projectRow = db
      .prepare('SELECT project_id FROM ppt_plans WHERE id = ?')
      .get(slideId) as { project_id: string } | undefined;
    const projectId = projectRow?.project_id ?? 'unknown';
    const validatedAction = assertDialogueWriteAction(
      action,
      ['clear_dialogues_for_regen'],
      'clearSlideDialogues',
    );
    const result = db.prepare('DELETE FROM dialogues WHERE plan_id = ?').run(slideId);
    logDialogueWriteEvent({
      scope: 'clearSlideDialogues',
      action: validatedAction,
      projectId,
      slideId,
      success: true,
    });
    return result.changes >= 0;
  } catch (error) {
    logDialogueWriteEvent({
      scope: 'clearSlideDialogues',
      action,
      projectId: 'unknown',
      slideId,
      success: false,
      reason: error instanceof Error ? error.message : 'unknown error',
    });
    console.error('Failed to clear slide dialogues:', error);
    return false;
  }
}

export async function replaceSlideDialogues(
  projectId: string,
  target: { slideId?: string; slideIndex?: number; dialogues: Dialogue[] },
  action: DialogueWriteAction = 'generate_dialogues',
): Promise<ChatRecord | null> {
  const allowedActions: readonly DialogueWriteAction[] = ['generate_dialogues', 'manual_edit_dialogues'];
  let validatedAction: DialogueWriteAction;
  try {
    validatedAction = assertDialogueWriteAction(action, allowedActions, 'replaceSlideDialogues');
  } catch (error) {
    logDialogueWriteEvent({
      scope: 'replaceSlideDialogues',
      action,
      projectId,
      slideId: target.slideId,
      success: false,
      reason: error instanceof Error ? error.message : 'unknown error',
    });
    throw error;
  }

  const runTransaction = db.transaction(() => {
    const now = Date.now();
    
    // 1. Validate project exists
    const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
    if (!project) {
      logDialogueWriteEvent({
        scope: 'replaceSlideDialogues',
        action: validatedAction,
        projectId,
        slideId: target.slideId,
        success: false,
        reason: 'project not found',
      });
      return null;
    }

    // 2. Find target slide
    let targetSlideId = target.slideId;
    
    if (!targetSlideId && typeof target.slideIndex === 'number') {
       const slide = db.prepare('SELECT id FROM ppt_plans WHERE project_id = ? ORDER BY idx ASC LIMIT 1 OFFSET ?').get(projectId, target.slideIndex) as {id: string};
       if (slide) targetSlideId = slide.id;
    }

    if (!targetSlideId) {
      logDialogueWriteEvent({
        scope: 'replaceSlideDialogues',
        action: validatedAction,
        projectId,
        slideId: target.slideId,
        success: false,
        reason: 'target slide not found',
      });
      return null;
    }

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
    logDialogueWriteEvent({
      scope: 'replaceSlideDialogues',
      action: validatedAction,
      projectId,
      slideId: targetSlideId,
      success: true,
    });

    return projectId;
  });

  const result = runTransaction();
  return result ? getChatSync(projectId) : null;
}

export async function deleteChat(id: string) {
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
}
