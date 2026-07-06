import type { ContentPart, DraftState } from './types';

import styles from './styles.module.scss';

export const EMPTY_DRAFT: DraftState = { text: '', images: [] };

export const cloneDraft = (d: DraftState): DraftState => ({ text: d.text, images: [...d.images] });

export const isDraftEmpty = (d: DraftState): boolean =>
  d.text.trim().length === 0 && d.images.length === 0;

export const draftToParts = (d: DraftState): ContentPart[] => {
  const parts: ContentPart[] = [];
  if (d.text.length > 0) parts.push({ type: 'text', content: d.text });
  for (const path of d.images) parts.push({ type: 'image', path });
  return parts;
};

export const partsToDraft = (parts: ContentPart[]): DraftState => {
  let text = '';
  const images: string[] = [];
  for (const part of parts) {
    if (part.type === 'text') text += part.content;
    else images.push(part.path);
  }
  return { text, images };
};

const IMG_RE = /\[Image #(\d+)\]/g;

export const draftToSendParts = (d: DraftState): ContentPart[] => {
  const parts: ContentPart[] = [];
  const used = new Set<number>();
  let last = 0;
  IMG_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = IMG_RE.exec(d.text)) !== null) {
    const before = d.text.slice(last, match.index);
    if (before.length > 0) parts.push({ type: 'text', content: before });
    const idx = parseInt(match[1] ?? '', 10) - 1;
    const img = d.images[idx];
    if (idx >= 0 && img !== undefined) {
      parts.push({ type: 'image', path: img });
      used.add(idx);
    }
    last = match.index + match[0].length;
  }
  const after = d.text.slice(last);
  if (after.length > 0) parts.push({ type: 'text', content: after });
  for (let i = 0; i < d.images.length; i++) {
    const img = d.images[i];
    if (!used.has(i) && img !== undefined) parts.push({ type: 'image', path: img });
  }
  return parts;
};

export const consolidateParts = (parts: ContentPart[]): ContentPart[] => {
  const out: ContentPart[] = [];
  for (const part of parts) {
    const last = out[out.length - 1];
    if (part.type === 'text' && last?.type === 'text') last.content += part.content;
    else out.push(part.type === 'text' ? { type: 'text', content: part.content } : part);
  }
  return out;
};

const makeImageChip = (num: number, path: string): HTMLSpanElement => {
  const span = document.createElement('span');
  span.contentEditable = 'false';
  span.className = styles.imageChip;
  span.dataset.imgpath = path;
  span.title = path;

  const label = document.createElement('span');
  label.textContent = `Image #${num}`;
  span.appendChild(label);

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = styles.imageRemove;
  remove.dataset.imgremove = '1';
  remove.tabIndex = -1;
  remove.setAttribute('aria-label', 'Remove image');
  remove.textContent = 'x';
  span.appendChild(remove);

  return span;
};

export const serializeEditor = (el: HTMLElement): DraftState => {
  const images: string[] = [];
  let text = '';
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? '';
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (node.dataset.imgpath) {
      images.push(node.dataset.imgpath);
      text += `[Image #${images.length}]`;
      return;
    }
    if (node.tagName === 'BR') {
      text += '\n';
      return;
    }
    const isBlock = node.tagName === 'DIV' || node.tagName === 'P';
    if (isBlock && text.length > 0 && !text.endsWith('\n')) text += '\n';
    for (const child of Array.from(node.childNodes)) walk(child);
  };
  for (const child of Array.from(el.childNodes)) walk(child);
  return { text, images };
};

export const renderEditor = (el: HTMLElement, draft: DraftState): void => {
  el.textContent = '';
  const appendText = (chunk: string) => {
    const lines = chunk.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) el.appendChild(document.createElement('br'));
      const ln = lines[i];
      if (ln) el.appendChild(document.createTextNode(ln));
    }
  };
  const re = /\[Image #(\d+)\]/g;
  let last = 0;
  let count = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(draft.text)) !== null) {
    const before = draft.text.slice(last, match.index);
    if (before.length > 0) appendText(before);
    const idx = parseInt(match[1] ?? '', 10) - 1;
    const img = draft.images[idx];
    if (idx >= 0 && img !== undefined) {
      count++;
      el.appendChild(makeImageChip(count, img));
    } else {
      appendText(match[0]);
    }
    last = match.index + match[0].length;
  }
  const after = draft.text.slice(last);
  if (after.length > 0) appendText(after);
};

export const placeCaretAtEnd = (el: HTMLElement): void => {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
};

export const getCaretOffset = (el: HTMLElement): number | null => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!el.contains(range.startContainer)) return null;
  const pre = document.createRange();
  pre.setStart(el, 0);
  try {
    pre.setEnd(range.startContainer, range.startOffset);
  } catch {
    return null;
  }
  const tmp = document.createElement('div');
  tmp.appendChild(pre.cloneContents());
  return serializeEditor(tmp).text.length;
};

export const insertPartsAtCaret = (
  el: HTMLElement,
  text: string,
  imagePaths: string[],
  startNum: number
): void => {
  const sel = window.getSelection();
  let range: Range;
  if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
    range = sel.getRangeAt(0);
  } else {
    range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
  }
  range.deleteContents();

  const frag = document.createDocumentFragment();
  if (text.length > 0) {
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) frag.appendChild(document.createElement('br'));
      const ln = lines[i];
      if (ln) frag.appendChild(document.createTextNode(ln));
    }
  }
  for (let i = 0; i < imagePaths.length; i++) {
    const p = imagePaths[i];
    if (p !== undefined) frag.appendChild(makeImageChip(startNum + i, p));
  }

  const lastNode = frag.lastChild;
  range.insertNode(frag);

  const after = document.createRange();
  if (lastNode) after.setStartAfter(lastNode);
  else after.setStart(range.endContainer, range.endOffset);
  after.collapse(true);
  sel?.removeAllRanges();
  sel?.addRange(after);
};

const getCaretRect = (el: HTMLElement): DOMRect | null => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!el.contains(range.startContainer)) return null;
  const rects = range.getClientRects();
  if (rects.length > 0 && rects[0]) return rects[0];
  const collapsed = document.createRange();
  collapsed.setStart(range.startContainer, range.startOffset);
  collapsed.collapse(true);
  const tmp = document.createElement('span');
  tmp.appendChild(document.createTextNode('​'));
  collapsed.insertNode(tmp);
  const rect = tmp.getBoundingClientRect();
  tmp.remove();
  return rect;
};

export const isCaretOnFirstLine = (el: HTMLElement): boolean => {
  const caret = getCaretRect(el);
  if (!caret) return true;
  const box = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);
  const padTop = parseFloat(style.paddingTop) || 0;
  const lineH = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.4 || 18;
  return caret.top - (box.top + padTop) < lineH * 0.7;
};

export const isCaretOnLastLine = (el: HTMLElement): boolean => {
  const caret = getCaretRect(el);
  if (!caret) return true;
  const box = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);
  const padBottom = parseFloat(style.paddingBottom) || 0;
  const lineH = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.4 || 18;
  return box.bottom - padBottom - caret.bottom < lineH * 0.7;
};
