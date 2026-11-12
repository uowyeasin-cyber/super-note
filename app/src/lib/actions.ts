import { getTask, setTaskDone, type Task } from './db';
import { armTask, disarmTask } from './alarms';
import { toast } from '../components/ui';

export function toggleTask(task: Task, t: { done: string; undo: string }, bump: () => void) {
  const nowDone = !task.done;
  setTaskDone(task.id, nowDone);
  if (nowDone) disarmTask(task.id);
  else { const fresh = getTask(task.id); if (fresh) armTask(fresh); }
  toast(nowDone ? t.done : t.undo);
  bump();
}
