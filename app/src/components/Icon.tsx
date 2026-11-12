import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'mic' | 'plus' | 'search' | 'settings' | 'check' | 'right' | 'left' | 'bell' | 'alarm' | 'phone'
  | 'trash' | 'copy' | 'share' | 'folder' | 'x' | 'sparkle' | 'repeat' | 'stop' | 'home' | 'library' | 'shield' | 'grid' | 'clock';

export function Icon({ name, size = 22, color = '#000', stroke = 1.9 }: { name: IconName; size?: number; color?: string; stroke?: number }) {
  const p = { stroke: color, strokeWidth: stroke, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const body = (() => {
    switch (name) {
      case 'mic': return <><Rect x={9} y={3} width={6} height={11} rx={3} {...p} /><Path d="M5 11a7 7 0 0 0 14 0M12 18v3" {...p} /></>;
      case 'plus': return <Path d="M12 5v14M5 12h14" {...p} />;
      case 'search': return <><Circle cx={11} cy={11} r={6.5} {...p} /><Path d="m20 20-4-4" {...p} /></>;
      case 'settings': return <><Circle cx={12} cy={12} r={3} {...p} /><Path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" {...p} /></>;
      case 'check': return <Path d="m5 12.5 4.5 4.5L19 7.5" {...p} />;
      case 'right': return <Path d="m9 6 6 6-6 6" {...p} />;
      case 'left': return <Path d="m15 6-6 6 6 6" {...p} />;
      case 'bell': return <Path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Zm4 4a2 2 0 0 0 4 0" {...p} />;
      case 'alarm': return <><Circle cx={12} cy={13} r={7} {...p} /><Path d="M12 10v3l2 2M4 5l3-2M20 5l-3-2" {...p} /></>;
      case 'phone': return <Path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" {...p} />;
      case 'trash': return <Path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" {...p} />;
      case 'copy': return <><Rect x={9} y={9} width={11} height={11} rx={2} {...p} /><Path d="M5 15V5a1 1 0 0 1 1-1h9" {...p} /></>;
      case 'share': return <Path d="M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" {...p} />;
      case 'folder': return <Path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" {...p} />;
      case 'x': return <Path d="M6 6l12 12M18 6 6 18" {...p} />;
      case 'sparkle': return <Path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3ZM19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z" {...p} />;
      case 'repeat': return <Path d="M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4" {...p} />;
      case 'stop': return <Rect x={7} y={7} width={10} height={10} rx={2} fill={color} stroke="none" />;
      case 'home': return <Path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1v-8Z" {...p} />;
      case 'library': return <Path d="M4 5h4v15H4zM10 5h4v15h-4zM16.5 5.5l3.8-1 3.2 14.6-3.8 1z" {...p} />;
      case 'shield': return <Path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" {...p} />;
      case 'grid': return <><Rect x={4} y={4} width={7} height={7} rx={2} {...p} /><Rect x={13} y={4} width={7} height={7} rx={2} {...p} /><Rect x={4} y={13} width={7} height={7} rx={2} {...p} /><Rect x={13} y={13} width={7} height={7} rx={2} {...p} /></>;
      case 'clock': return <><Circle cx={12} cy={12} r={8} {...p} /><Path d="M12 8v4l3 2" {...p} /></>;
    }
  })();
  return <Svg width={size} height={size} viewBox="0 0 24 24">{body}</Svg>;
}
