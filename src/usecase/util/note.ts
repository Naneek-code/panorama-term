export interface NoteColor {
  body: string;
  text: string;
  darkBody: string;
  darkText: string;
}

export const NOTE_PALETTE: NoteColor[] = [
  { body: '#fef8c4', text: '#5c4036', darkBody: '#d9c979', darkText: '#4a3a20' },
  { body: '#f8bad0', text: '#880e4e', darkBody: '#d98cab', darkText: '#54132f' },
  { body: '#badefa', text: '#0c46a0', darkBody: '#8fbde4', darkText: '#123a66' },
  { body: '#c8e6c8', text: '#1a5e20', darkBody: '#9ccc9e', darkText: '#1c4522' },
  { body: '#fee0b2', text: '#e44400', darkBody: '#e3b578', darkText: '#5a2f10' },
  { body: '#e0bee6', text: '#4a148c', darkBody: '#c99ad3', darkText: '#3d1a52' },
  { body: '#2c2c2c', text: '#fefefe', darkBody: '#3a3a3a', darkText: '#ececec' },
  { body: '#36464e', text: '#fefefe', darkBody: '#465862', darkText: '#e8edf0' }
];

export const NOTE_DEFAULT_COLOR = NOTE_PALETTE[0].body;

export const noteTextColor = (hex: string): string => {
  const found = NOTE_PALETTE.find((p) => p.body.toLowerCase() === hex.toLowerCase());
  if (found) return found.text;
  const c = hex.replace('#', '');
  if (c.length < 6) return '#1a1a1a';
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? '#1a1a1a' : '#f5f5f5';
};

export const noteTheme = (hex?: string): { body: string; text: string } => {
  const raw = hex || NOTE_DEFAULT_COLOR;
  const found = NOTE_PALETTE.find((p) => p.body.toLowerCase() === raw.toLowerCase());
  if (!found) return { body: raw, text: noteTextColor(raw) };
  return {
    body: `light-dark(${found.body}, ${found.darkBody})`,
    text: `light-dark(${found.text}, ${found.darkText})`
  };
};
