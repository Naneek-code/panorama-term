import type { PtyServerMessage } from '~/domain/interfaces/pty.interface';

const SIDECAR_WS = 'ws://127.0.0.1:9777';

export interface PtyConnectionParams {
  cols: number;
  rows: number;
  tileId: string;
}

export interface PtyHandlers {
  onExit: () => void;
  onReady: (reused: boolean) => void;
  onData: (bytes: Uint8Array) => void;
}

export const openPtyConnection = (params: PtyConnectionParams, handlers: PtyHandlers): WebSocket => {
  const { tileId, cols, rows } = params;
  const query = `tileId=${encodeURIComponent(tileId)}&cols=${cols}&rows=${rows}`;
  const ws = new WebSocket(`${SIDECAR_WS}/pty?${query}`);
  ws.binaryType = 'arraybuffer';
  ws.onmessage = (e) => {
    if (typeof e.data === 'string') {
      const msg = JSON.parse(e.data) as PtyServerMessage;
      if (msg.t === 'ready') handlers.onReady(msg.reused);
      else if (msg.t === 'exit') handlers.onExit();
      return;
    }
    handlers.onData(new Uint8Array(e.data as ArrayBuffer));
  };
  return ws;
};

export const sendPtyInput = (ws: WebSocket, data: string): void => {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: 'in', d: data }));
};
