export type ChunkKind = 'insert' | 'delete' | 'modify';

export type DiffSide = 'orig' | 'mod';

export type DiffViewMode = 'side-by-side' | 'unified';

export type HighlightMode = 'lines' | 'words' | 'characters' | 'none';

export interface DiffChunk {
  kind: ChunkKind;
  origStart: number;
  origEnd: number;
  modStart: number;
  modEnd: number;
}

export type VisualRow =
  | { kind: 'line'; lineNumber: number }
  | { kind: 'skip'; count: number; firstHidden: number; lastHidden: number; index: number };

export type UnifiedRow =
  | { kind: 'unchanged'; oldLine: number; newLine: number }
  | { kind: 'deleted'; oldLine: number }
  | { kind: 'added'; newLine: number };

export type UnifiedVisual =
  | { kind: 'row'; row: UnifiedRow }
  | { kind: 'skip'; rows: UnifiedRow[]; index: number };

export interface IntraLineRange {
  startCol: number;
  endCol: number;
}

export interface IntraLineHighlights {
  oldByLine: Map<number, IntraLineRange[]>;
  newByLine: Map<number, IntraLineRange[]>;
  oldKindOverride: Map<number, ChunkKind>;
  newKindOverride: Map<number, ChunkKind>;
}

export interface ScrollAnchor {
  sourceY: number;
  targetY: number;
}

export interface PaneApi {
  getElement: () => HTMLDivElement | null;
  getScrollTop: () => number;
  setScrollTop: (y: number) => void;
  getTopForLine: (line: number) => number;
  getRowTop: (index: number) => number;
  getRows: () => VisualRow[];
  onScroll: (cb: () => void) => () => void;
  onResize: (cb: () => void) => () => void;
}
