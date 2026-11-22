import React from 'react';
import { Image, View } from 'react-native';
import type { Note } from '../lib/db';
import { useApp } from '../lib/store';
import { T } from './ui';

/** Photo preview or source link under a note, when it has one. */
export function NoteThumb({ note, big }: { note: Note; big?: boolean }) {
  const { c } = useApp();
  if (note.media && /\.(jpe?g|png|webp|heic)$/i.test(note.media)) {
    return <Image source={{ uri: note.media }} style={{ marginTop: 10, width: '100%', height: big ? 320 : 150, borderRadius: 14, backgroundColor: c.sunken }} resizeMode="cover" />;
  }
  if (note.url) {
    return <View style={{ marginTop: 8 }}><T kind="small" color={c.accent} numberOfLines={1}>{note.url}</T></View>;
  }
  return null;
}
