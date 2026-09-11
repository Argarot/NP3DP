import type { CSSProperties } from 'react';

const paths = {
  save: 'M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4',
  open: 'M3 7h7l2 3h9l-3 10H3V7Zm0 0V4h7l2 3h6v3',
  undo: 'M8 5 3 10l5 5M3 10h11a6 6 0 0 1 0 12',
  redo: 'm16 5 5 5-5 5m5-5H10a6 6 0 0 0 0 12',
  play: 'm8 5 11 7-11 7V5Z',
  pause: 'M8 5v14M16 5v14',
  reset: 'M4 10a8 8 0 1 1 1 8M4 4v6h6',
  cube: 'm12 3 9 5v9l-9 5-9-5V8l9-5Zm0 10 9-5M12 13 3 8m9 5v9',
  plus: 'M12 5v14M5 12h14',
  close: 'm6 6 12 12M18 6 6 18',
  chevron: 'm8 5 7 7-7 7',
  info: 'M12 10v7m0-10v.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
};
export function Icon({ name, size = 18, style }: { name: keyof typeof paths; size?: number; style?: CSSProperties }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={style}><path d={paths[name]} /></svg>;
}
