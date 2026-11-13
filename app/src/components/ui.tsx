import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useApp } from '../lib/store';
import { R } from '../lib/theme';
import { Icon, type IconName } from './Icon';

export function T({ style, kind = 'body', color, children, numberOfLines }: {
  style?: StyleProp<TextStyle>; kind?: 'h1' | 'h2' | 'h3' | 'body' | 'small' | 'label'; color?: string; children: React.ReactNode; numberOfLines?: number;
}) {
  const { c } = useApp();
  const k = {
    h1: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5, color: c.ink },
    h2: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.2, color: c.ink },
    h3: { fontSize: 16, fontWeight: '600' as const, color: c.ink },
    body: { fontSize: 15, lineHeight: 22, color: c.ink },
    small: { fontSize: 13, lineHeight: 18, color: c.ink3 },
    label: { fontSize: 12, fontWeight: '700' as const, letterSpacing: 0.8, textTransform: 'uppercase' as const, color: c.ink3 },
  }[kind];
  return <Text numberOfLines={numberOfLines} style={[k, color ? { color } : null, style]}>{children}</Text>;
}

export function Press({ onPress, style, children, haptic = true, ...rest }: PressableProps & { style?: StyleProp<ViewStyle>; haptic?: boolean; children: React.ReactNode }) {
  return (
    <Pressable
      {...rest}
      onPress={(e) => { if (haptic) Haptics.selectionAsync().catch(() => {}); onPress?.(e); }}
      style={({ pressed }) => [style as ViewStyle, pressed && { opacity: 0.7, transform: [{ scale: 0.985 }] }]}
    >
      {children}
    </Pressable>
  );
}

export function Card({ children, style, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const { c } = useApp();
  const base = [{ backgroundColor: c.surface, borderRadius: R.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line, padding: 16 }, style];
  return onPress ? <Press onPress={onPress} style={base}>{children}</Press> : <View style={base}>{children}</View>;
}

export function Chip({ label, active, onPress, color, icon }: { label: string; active?: boolean; onPress?: () => void; color?: string; icon?: IconName }) {
  const { c } = useApp();
  const fg = active ? c.onAccent : color ?? c.ink2;
  return (
    <Press onPress={onPress} style={{
      flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: 999,
      backgroundColor: active ? c.accent : c.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: active ? c.accent : c.line,
    }}>
      {icon ? <Icon name={icon} size={15} color={fg} /> : null}
      <Text style={{ color: fg, fontSize: 13.5, fontWeight: '600' }}>{label}</Text>
    </Press>
  );
}

export function Btn({ label, onPress, kind = 'primary', icon, disabled, style }: {
  label: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'danger'; icon?: IconName; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const { c } = useApp();
  const bg = kind === 'primary' ? c.accent : 'transparent';
  const fg = kind === 'primary' ? c.onAccent : kind === 'danger' ? c.danger : c.ink;
  return (
    <Press disabled={disabled} onPress={onPress} style={[{
      height: 50, borderRadius: R.md, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
      borderWidth: kind === 'primary' ? 0 : StyleSheet.hairlineWidth, borderColor: c.line, opacity: disabled ? 0.5 : 1, paddingHorizontal: 18,
    }, style]}>
      {icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <Text style={{ color: fg, fontSize: 16, fontWeight: '700' }}>{label}</Text>
    </Press>
  );
}

export function IconBtn({ name, onPress, label }: { name: IconName; onPress: () => void; label: string }) {
  const { c } = useApp();
  return (
    <Press accessibilityLabel={label} onPress={onPress} style={{
      width: 42, height: 42, borderRadius: 13, backgroundColor: c.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon name={name} size={20} color={c.ink2} />
    </Press>
  );
}

export function Section({ title, right, children, style }: { title: string; right?: React.ReactNode; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ marginTop: 26 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 2 }}>
        <T kind="label">{title}</T>
        {right}
      </View>
      {children}
    </View>
  );
}

/** Small message that slides up and fades; one at a time. */
let showToastImpl: ((msg: string) => void) | null = null;
export function toast(msg: string) { showToastImpl?.(msg); }

export function ToastHost() {
  const { c } = useApp();
  const [msg, setMsg] = useState('');
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    showToastImpl = (m) => {
      setMsg(m);
      if (timer) clearTimeout(timer);
      Animated.timing(a, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      timer = setTimeout(() => Animated.timing(a, { toValue: 0, duration: 220, useNativeDriver: true }).start(), 2200);
    };
    return () => { showToastImpl = null; if (timer) clearTimeout(timer); };
  }, [a]);
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', left: 24, right: 24, bottom: 110, alignItems: 'center', opacity: a,
      transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
    }}>
      <View style={{ backgroundColor: c.dark ? '#eef1f6' : '#101828', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14 }}>
        <Text style={{ color: c.dark ? '#101828' : '#ffffff', fontSize: 14, fontWeight: '600' }}>{msg}</Text>
      </View>
    </Animated.View>
  );
}
