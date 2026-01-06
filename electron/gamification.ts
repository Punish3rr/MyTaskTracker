// Gamification logic and XP calculations
import { getGamification, updateGamificationStats } from './db/queries';
import { getTaskById } from './db/queries';
import type { TimelineEntry } from './db/schema';

export async function updateGamification(action: 'create_task' | 'add_content' | 'complete_task' | 'delete_incomplete_task') {
  const stats = await getGamification();
  if (!stats) return;

  const now = Date.now();
  const today = Math.floor(now / 86400000);
  const lastActiveDay = Math.floor(stats.last_active_date / 86400000);
  
  let xp = stats.xp;
  let streak = stats.streak;

  // Calculate XP based on action
  switch (action) {
    case 'create_task':
      xp += 5;
      break;
    case 'add_content':
      xp += 2;
      break;
    case 'complete_task':
      xp += 20;
      break;
    case 'delete_incomplete_task':
      xp = Math.max(0, xp - 5); // Subtract 5 XP, but don't go below 0
      break;
  }

  // Streak logic
  if (today === lastActiveDay) {
    // Same day, streak continues
  } else if (today === lastActiveDay + 1) {
    // Consecutive day, increment streak
    streak += 1;
  } else {
    // Streak broken
    streak = 1;
  }

  // Calculate level
  const level = Math.floor(xp / 100) + 1;

  await updateGamificationStats({
    xp,
    level,
    streak,
    last_active_date: now,
  });
}

export async function checkNecromancerBonus(taskId: string): Promise<number> {
  const taskData = await getTaskById(taskId);
  if (!taskData) return 0;

  const task = taskData.task;
  const now = Date.now();
  const idleAge = Math.floor((now - task.last_touched_at) / 86400000);

  if (idleAge > 10) {
    // Check if necromancer bonus was already given for this neglect cycle
    const timeline = taskData.timeline;
    const lastGamifyEntry = timeline
      .filter((e: TimelineEntry) => e.type === 'GAMIFY')
      .sort((a: TimelineEntry, b: TimelineEntry) => b.created_at - a.created_at)[0];

    if (lastGamifyEntry) {
      const lastGamifyAge = Math.floor((now - lastGamifyEntry.created_at) / 86400000);
      // If last gamify was recent and task was already neglected, bonus already given
      if (lastGamifyAge < idleAge) {
        return 0;
      }
    }

    // Grant necromancer bonus
    const stats = await getGamification();
    if (stats) {
      const newXp = stats.xp + 50;
      const newLevel = Math.floor(newXp / 100) + 1;
      await updateGamificationStats({
        xp: newXp,
        level: newLevel,
      });

      // Record in timeline
      const { addTimelineEntry } = await import('./db/queries');
      await addTimelineEntry({
        taskId,
        type: 'GAMIFY',
        content: `Necromancer Bonus: +50 XP (Task was idle for ${idleAge} days)`,
        updateTouched: false,
      });

      return 50;
    }
  }

  return 0;
}
