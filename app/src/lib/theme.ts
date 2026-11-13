// Calm light + dark palettes with one accent, matching the approved design.
export type Mode = 'auto' | 'light' | 'dark';
export type AccentName = 'indigo' | 'blue' | 'emerald' | 'violet' | 'amber' | 'rose' | 'graphite';

export const ACCENTS: Record<AccentName, [string, string]> = {
  indigo: ['#4b3be0', '#9389ff'],
  blue: ['#2563eb', '#6b9bff'],
  emerald: ['#059669', '#34d399'],
  violet: ['#7c3aed', '#a78bfa'],
  amber: ['#c2410c', '#fb923c'],
  rose: ['#db2777', '#f472b6'],
  graphite: ['#334155', '#cbd5e1'],
};

export type Palette = {
  dark: boolean;
  bg: string; surface: string; sunken: string; line: string;
  ink: string; ink2: string; ink3: string;
  accent: string; accentSoft: string; onAccent: string;
  danger: string; warn: string; ok: string;
};

export function palette(dark: boolean, accent: AccentName): Palette {
  const a = ACCENTS[accent][dark ? 1 : 0];
  return dark
    ? { dark, bg: '#0b0f17', surface: '#141a24', sunken: '#1b2230', line: '#252e3d', ink: '#eef1f6', ink2: '#b3bccb', ink3: '#7c8799',
        accent: a, accentSoft: a + '26', onAccent: '#0b0f17', danger: '#f87171', warn: '#fbbf24', ok: '#34d399' }
    : { dark, bg: '#f5f6f8', surface: '#ffffff', sunken: '#eef0f4', line: '#e3e6ec', ink: '#101828', ink2: '#475467', ink3: '#8a94a6',
        accent: a, accentSoft: a + '1a', onAccent: '#ffffff', danger: '#dc2626', warn: '#b45309', ok: '#059669' };
}

export const AREA_COLORS: Record<string, string> = {
  academic: '#2563eb', business: '#c2410c', skills: '#7c3aed', social: '#db2777', family: '#059669', personal: '#475467',
};

export const R = { sm: 10, md: 14, lg: 20, xl: 28 };
