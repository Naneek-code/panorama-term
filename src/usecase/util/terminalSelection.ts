export interface Cell {
  row: number;
  col: number;
}

export interface Selection {
  a: Cell;
  b: Cell;
}

export const WORD_SEPARATORS = ' ()[]{}\',"`';

export const wordSelection = (line: string, row: number, col: number): Selection => {
  const chars = Array.from(line);
  const sep = (i: number): boolean => {
    const ch = chars[i];
    return ch === undefined || WORD_SEPARATORS.includes(ch);
  };
  const target = sep(col);
  let c0 = col;
  let c1 = col;
  while (c0 > 0 && sep(c0 - 1) === target) c0--;
  while (c1 < chars.length - 1 && sep(c1 + 1) === target) c1++;
  return { a: { row, col: c0 }, b: { row, col: c1 } };
};

export interface UrlSpan {
  url: string;
  row: number;
  c0: number;
  c1: number;
}

export const urlSpanAt = (line: string, row: number, col: number): UrlSpan | null => {
  const chars = Array.from(line);
  const isUrlChar = (c: string | undefined): boolean => c !== undefined && c !== ' ' && c !== '\t';
  if (!isUrlChar(chars[col])) return null;
  let s = col;
  let e = col;
  while (s > 0 && isUrlChar(chars[s - 1])) s--;
  while (e < chars.length - 1 && isUrlChar(chars[e + 1])) e++;
  const token = chars.slice(s, e + 1).join('');
  const m = token.match(/https?:\/\/\S+/i);
  if (!m || m.index === undefined) return null;
  const url = m[0].replace(/[.,;:!?)\]}'"]+$/, '');
  const c0 = s + m.index;
  return { url, row, c0, c1: c0 + Array.from(url).length - 1 };
};

export const lineSelection = (row: number, cols: number): Selection => ({
  a: { row, col: 0 },
  b: { row, col: cols - 1 }
});

export const orderSel = (s: Selection): { s: Cell; e: Cell } => {
  const { a, b } = s;
  if (a.row < b.row || (a.row === b.row && a.col <= b.col)) return { s: a, e: b };
  return { s: b, e: a };
};

export const selectText = (lines: string[], cols: number, sel: Selection): string => {
  const { s, e } = orderSel(sel);
  const out: string[] = [];
  for (let r = s.row; r <= e.row; r++) {
    const chars = Array.from(lines[r] ?? '');
    const c0 = r === s.row ? s.col : 0;
    const c1 = r === e.row ? e.col : cols - 1;
    let line = '';
    for (let c = c0; c <= c1; c++) line += chars[c] ?? ' ';
    out.push(line.replace(/\s+$/, ''));
  }
  return out.join('\n');
};
