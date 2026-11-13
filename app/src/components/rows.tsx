import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../lib/store';
import { whenLabel } from '../lib/i18n';
import { AREA_COLORS } from '../lib/theme';
import type { Note, Task } from '../lib/db';
import { Icon } from './Icon';
import { Press, T } from './ui';

export function LevelBadge({ level }: { level: Task['level'] }) {
  const { c, t } = useApp();
  const icon = level === 'critical' ? 'phone' : level === 'urgent' ? 'alarm' : 'bell';
  const col = level === 'critical' ? c.danger : level === 'urgent' ? c.warn : c.ink3;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Icon name={icon} size={13} color={col} />
      <T kind="small" color={col}>{t[level]}</T>
    </View>
  );
}

export function TaskRow({ task, onToggle, last }: { task: Task; onToggle: () => void; last?: boolean }) {
  const { c, s } = useApp();
  const overdue = !task.done && task.at !== null && task.at < Date.now();
  return (
    <Press onPress={() => router.push(`/note/${task.note_id}`)} style={{
      flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16,
      borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: c.line,
    }}>
      <Press accessibilityLabel="toggle done" onPress={onToggle} hitSlop={10} style={{
        width: 26, height: 26, borderRadius: 9, borderWidth: 1.6, borderColor: task.done ? c.accent : c.ink3,
        backgroundColor: task.done ? c.accent : 'transparent', alignItems: 'center', justifyContent: 'center',
      }}>
        {task.done ? <Icon name="check" size={16} color={c.onAccent} stroke={2.4} /> : null}
      </Press>
      <View style={{ flex: 1 }}>
        <T kind="h3" numberOfLines={2} style={task.done ? { textDecorationLine: 'line-through', color: c.ink3 } : null}>{task.title}</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
          {task.at !== null ? <T kind="small" color={overdue ? c.danger : c.ink2}>{whenLabel(task.at, s.lang)}</T> : null}
          {task.repeat !== 'none' ? <Icon name="repeat" size={13} color={c.ink3} /> : null}
          <LevelBadge level={task.level} />
        </View>
      </View>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: AREA_COLORS[task.area] }} />
    </Press>
  );
}

export function NoteRow({ note, last }: { note: Note; last?: boolean }) {
  const { c, t, s } = useApp();
  return (
    <Press onPress={() => router.push(`/note/${note.id}`)} style={{
      paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: c.line,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: AREA_COLORS[note.area] }} />
        <T kind="small">{t[note.area]} · {whenLabel(note.created, s.lang)}</T>
      </View>
      <T kind="h3" numberOfLines={1} style={{ marginTop: 6 }}>{note.title}</T>
      {note.text !== note.title ? <T kind="small" numberOfLines={2} color={c.ink2} style={{ marginTop: 2 }}>{note.text}</T> : null}
    </Press>
  );
}

export function ListCard({ children }: { children: React.ReactNode }) {
  const { c } = useApp();
  return <View style={{ backgroundColor: c.surface, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line, overflow: 'hidden' }}>{children}</View>;
}
