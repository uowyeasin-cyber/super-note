// Bridge between tasks in the database and the native reminder engine.
import { PermissionsAndroid, Platform } from 'react-native';
import SuperAlarm, { type AlarmEvent } from '../../modules/super-alarm';
import { getTask, openTasks, setTaskDone, type Task } from './db';

export const engineAvailable = !!SuperAlarm;

export function armTask(t: Task, body = '') {
  if (!SuperAlarm || t.at === null || t.done) return;
  // Stable id = task id, so saving the same task again replaces it instead of ringing twice.
  SuperAlarm.schedule(t.id, t.at, t.title, body, t.level, t.repeat, !!t.escalate);
}

export function disarmTask(id: string) {
  SuperAlarm?.cancel(id);
}

/** Re-arm every open task; safe to call on each app start. */
export function rearmAll() {
  if (!SuperAlarm) return;
  const now = Date.now();
  for (const t of openTasks()) {
    if (t.at !== null && (t.at > now || t.repeat !== 'none')) armTask(t);
  }
}

/** Apply Done taps made on the notification or alarm screen while the app was closed. */
export function syncEvents(): number {
  if (!SuperAlarm) return 0;
  let n = 0;
  try {
    const events = JSON.parse(SuperAlarm.consumeEvents()) as AlarmEvent[];
    for (const e of events) {
      if (e.type === 'done') {
        const t = getTask(e.id);
        if (t && t.repeat === 'none') { setTaskDone(e.id, true); n++; }
      }
    }
  } catch {}
  return n;
}

export async function askNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  if (Platform.Version < 33) return true;
  const r = await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS' as never);
  return r === PermissionsAndroid.RESULTS.GRANTED;
}

export type EngineStatus = { notifications: boolean; exact: boolean; fullScreen: boolean; battery: boolean };
export function engineStatus(): EngineStatus {
  if (!SuperAlarm) return { notifications: false, exact: false, fullScreen: false, battery: false };
  return {
    notifications: SuperAlarm.notificationsEnabled(),
    exact: SuperAlarm.canScheduleExact(),
    fullScreen: SuperAlarm.canUseFullScreen(),
    battery: SuperAlarm.isIgnoringBatteryOptimizations(),
  };
}

export { SuperAlarm };
