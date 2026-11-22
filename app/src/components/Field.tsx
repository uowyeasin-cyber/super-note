import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useApp } from '../lib/store';
import { T } from './ui';

/** Labelled text box used by the form screens (class, message, profile). */
export function Field({ label, value, onChange, multiline, keyboard, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; multiline?: boolean; keyboard?: 'default' | 'phone-pad' | 'email-address'; placeholder?: string;
}) {
  const { c } = useApp();
  return (
    <View style={{ marginTop: 12 }}>
      <T kind="small" style={{ marginBottom: 6 }}>{label}</T>
      <TextInput
        accessibilityLabel={label} value={value} onChangeText={onChange} multiline={multiline} keyboardType={keyboard ?? 'default'}
        placeholder={placeholder} placeholderTextColor={c.ink3}
        style={{
          color: c.ink, fontSize: 16, backgroundColor: c.surface, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line,
          paddingHorizontal: 14, paddingVertical: multiline ? 12 : 0, height: multiline ? undefined : 48, minHeight: multiline ? 96 : undefined, textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
    </View>
  );
}
