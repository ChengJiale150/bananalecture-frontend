import db from '../db';
import { ChatRecord, Slide, Dialogue } from '../chat-store';
import { normalizeDialogueRole, normalizeDialogueEmotion, normalizeDialogueSpeed, parseJSON } from './utils';

// Helper to reconstruct ChatRecord from DB rows
export function getChatSync(id: string, includeDialogues: boolean = false): ChatRecord | null {
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
