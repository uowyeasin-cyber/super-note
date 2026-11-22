import { NativeModule, requireOptionalNativeModule } from 'expo';

export type AlarmLevel = 'normal' | 'urgent' | 'critical';
export type AlarmRepeat = 'none' | 'daily' | 'weekly';
export type AlarmEvent = { type: 'done' | 'snooze' | 'fired'; id: string; at: number };

declare class SuperAlarmNative extends NativeModule<{}> {
  schedule(id: string, timeMs: number, title: string, body: string, level: AlarmLevel, repeat: AlarmRepeat, escalate: boolean): boolean;
  cancel(id: string): boolean;
  list(): string;
  consumeEvents(): string;
  canScheduleExact(): boolean;
  openExactAlarmSettings(): void;
  canUseFullScreen(): boolean;
  openFullScreenSettings(): void;
  notificationsEnabled(): boolean;
  openNotificationSettings(): void;
  isIgnoringBatteryOptimizations(): boolean;
  openBatterySettings(): void;
  testRing(level: AlarmLevel): boolean;
  takeCrash?(): string;
  saveCrash?(text: string): boolean;
}

/** Null on platforms without the native engine (web preview, Expo Go). */
export default requireOptionalNativeModule<SuperAlarmNative>('SuperAlarm');
