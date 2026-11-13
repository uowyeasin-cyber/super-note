import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { getLocales } from 'expo-localization';
import { kvGet, kvSet } from './db';
import { STRINGS, type Lang, type Strings } from './i18n';
import { palette, type AccentName, type Mode, type Palette } from './theme';
import type { Level } from './parse';
import { DEFAULT_MODEL } from './ai';

export type Settings = {
  lang: Lang;
  speech: 'en-US' | 'bn-BD';
  mode: Mode;
  accent: AccentName;
  defaultLevel: Level;
  escalate: boolean;
  aiKey: string;
  aiModel: string;
  onboarded: boolean;
};

const DEFAULTS: Settings = {
  lang: 'en', speech: 'en-US', mode: 'auto', accent: 'blue', defaultLevel: 'normal',
  escalate: true, aiKey: '', aiModel: DEFAULT_MODEL, onboarded: false,
};

function load(): Settings {
  try {
    const raw = kvGet('settings');
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  // First run: English UI by default; speech follows the phone's language.
  const bnPhone = getLocales().some((l) => l.languageCode === 'bn');
  return { ...DEFAULTS, speech: bnPhone ? 'bn-BD' : 'en-US' };
}

type Ctx = {
  s: Settings;
  set: (p: Partial<Settings>) => void;
  t: Strings;
  c: Palette;
  version: number;
  bump: () => void;
};

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<Settings>(load);
  const [version, setVersion] = useState(0);
  const scheme = useColorScheme();
  const set = useCallback((p: Partial<Settings>) => {
    setS((old) => {
      const next = { ...old, ...p };
      kvSet('settings', JSON.stringify(next));
      return next;
    });
  }, []);
  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const dark = s.mode === 'dark' || (s.mode === 'auto' && scheme === 'dark');
  const value = useMemo<Ctx>(() => ({ s, set, t: STRINGS[s.lang], c: palette(dark, s.accent), version, bump }), [s, set, dark, version, bump]);
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const v = useContext(AppCtx);
  if (!v) throw new Error('useApp outside AppProvider');
  return v;
}
