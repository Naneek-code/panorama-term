export interface PtyExitMessage {
  t: 'exit';
}

export interface PtyReadyMessage {
  t: 'ready';
  reused: boolean;
}

export type PtyServerMessage = PtyExitMessage | PtyReadyMessage;
