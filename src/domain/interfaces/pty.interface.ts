export interface PtyReadyMessage {
  t: 'ready';
  reused: boolean;
  cols: number;
  rows: number;
}

export interface PtyExitMessage {
  t: 'exit';
}

export type PtyServerMessage = PtyReadyMessage | PtyExitMessage;

export interface GridFrame {
  rows: number;
  cols: number;
  cursorRow: number;
  cursorCol: number;
  cursorHidden: boolean;
  offset: number;
  lines: string[];
  attrs: Uint32Array;
}
