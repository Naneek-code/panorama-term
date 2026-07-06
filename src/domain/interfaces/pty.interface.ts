export interface PtyReadyMessage {
  t: 'ready';
  reused: boolean;
  cols: number;
  rows: number;
  resumeId: string | null;
}

export interface PtyExitMessage {
  t: 'exit';
}

export interface PtyCwdMessage {
  t: 'cwd';
  cwd: string;
}

export interface ClaudeState {
  model?: string;
  mode?: string;
  permissionMode?: string;
  contextTokens?: number;
  defaultModel?: string;
}

export interface PtyClaudeMessage extends ClaudeState {
  t: 'claude';
}

export type PtyServerMessage = PtyReadyMessage | PtyExitMessage | PtyCwdMessage | PtyClaudeMessage;

export interface GridFrame {
  rows: number;
  cols: number;
  cursorRow: number;
  cursorCol: number;
  cursorHidden: boolean;
  mouseMode: number;
  offset: number;
  lines: string[];
  attrs: Uint32Array;
}
