import React from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';

import { loadHackFont } from '~/usecase/util/fontUtils';
import { BASE_FONT, SETTLE_DELAY } from '~/usecase/util/constants';
import { sendPtyInput, openPtyConnection } from '~/adapter/pty/pty.client';

import '@xterm/xterm/css/xterm.css';

export interface UseTerminalParams {
  scale: number;
  bodyW: number;
  bodyH: number;
  tileId: string;
}

type Cell = { w: number; h: number };

export const useTerminal = ({ tileId, scale, bodyW, bodyH }: UseTerminalParams) => {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const scalerRef = React.useRef<HTMLDivElement>(null);
  const termRef = React.useRef<Terminal | null>(null);
  const baseCell = React.useRef<Cell | null>(null);
  const zoomGen = React.useRef(0);
  const settleTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const measureCell = (): Cell | null => {
    const cell = (termRef.current as any)?._core?._renderService?.dimensions?.css?.cell;
    return cell?.width && cell?.height ? { w: cell.width, h: cell.height } : null;
  };

  const applyTransform = () => {
    const scaler = scalerRef.current;
    const base = baseCell.current;
    const cell = measureCell();
    if (!scaler) return;
    if (!base || !cell) {
      scaler.style.transform = 'scale(1)';
      return;
    }
    let sx = base.w / cell.w;
    let sy = base.h / cell.h;
    if (Math.abs(sx - 1) < 0.005) sx = 1;
    if (Math.abs(sy - 1) < 0.005) sy = 1;
    scaler.style.transform = `scale(${sx}, ${sy})`;
  };

  const settle = (k: number) => {
    const term = termRef.current;
    const host = hostRef.current;
    if (!term || !host) return;
    const font = Math.max(BASE_FONT, Math.round(BASE_FONT * k));
    const f = font / BASE_FONT;
    host.style.width = `${Math.ceil(bodyW * f)}px`;
    host.style.height = `${Math.ceil(bodyH * f)}px`;
    if (term.options.fontSize !== font) term.options.fontSize = font;
    const gen = zoomGen.current;
    let tries = 0;
    const tick = () => {
      if (zoomGen.current !== gen) return;
      applyTransform();
      if (++tries < 6) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const applyZoom = (k: number) => {
    zoomGen.current += 1;
    applyTransform();
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => settle(k), SETTLE_DELAY);
  };

  React.useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | null = null;

    void loadHackFont().then(() => {
      if (disposed) return;
      const host = hostRef.current!;
      const scaler = scalerRef.current!;
      scaler.style.transform = 'scale(1)';
      host.style.width = `${bodyW}px`;
      host.style.height = `${bodyH}px`;

      const term = new Terminal({
        fontSize: BASE_FONT,
        fontFamily: 'Hack, monospace',
        cursorBlink: true,
        scrollback: 5000,
        theme: { background: '#0b0e14', foreground: '#c7d0e0' }
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(host);
      let webgl: WebglAddon | null = null;
      try {
        webgl = new WebglAddon();
        webgl.onContextLoss(() => webgl?.dispose());
        term.loadAddon(webgl);
      } catch {}
      fit.fit();
      termRef.current = term;
      baseCell.current = measureCell();
      settle(scale);

      let ws: WebSocket | null = null;
      const connect = () => {
        ws = openPtyConnection(
          { tileId, cols: term.cols, rows: term.rows },
          {
            onData: (bytes) => term.write(bytes),
            onExit: () => term.write('\r\n\x1b[90m[process exited]\x1b[0m\r\n'),
            onReady: (reused) => {
              if (reused) term.reset();
            }
          }
        );
        ws.onclose = () => {
          if (!disposed) setTimeout(connect, 800);
        };
      };
      connect();

      const dataSub = term.onData((d) => {
        if (ws) sendPtyInput(ws, d);
      });

      cleanup = () => {
        zoomGen.current += 1;
        clearTimeout(settleTimer.current);
        termRef.current = null;
        try {
          dataSub.dispose();
        } catch {}
        ws?.close();
        try {
          webgl?.dispose();
        } catch {}
        try {
          term.dispose();
        } catch {}
      };
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [tileId]);

  React.useEffect(() => {
    applyZoom(scale);
  }, [scale, bodyW, bodyH]);

  return { hostRef, scalerRef };
};
