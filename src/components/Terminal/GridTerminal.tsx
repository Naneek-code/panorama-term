import React from 'react';

import { getSetting } from '~/adapter/settings/settings.client';
import { scheduleConnect } from '~/usecase/util/connectScheduler';
import { TERMINAL_TARGET_KEY } from '~/usecase/util/terminalTarget';
import { sendPtyInput, sendPtyScroll, sendPtyResize, openPtyConnection } from '~/adapter/pty/pty.client';

import type { GridFrame } from '~/domain/interfaces/pty.interface';

import styles from './styles.module.scss';

interface GridTerminalProps {
  tileId: string;
  cwd?: string;
  cols: number;
  rows: number;
  active: boolean;
  visible: boolean;
  k: number;
}

const FONT = 12;
const CELL_H = 15;
const PAINT_MS = 60;
const BG = '#0b0e14';

let cellW = 7.23;
let fontReady = false;
const measureCell = () => {
  const c = document.createElement('canvas').getContext('2d');
  if (!c) return;
  c.font = `${FONT}px Hack, monospace`;
  const w = c.measureText('M').width;
  if (w > 0) cellW = w;
};

const ensureFont = (): Promise<void> => {
  if (fontReady) return Promise.resolve();
  return Promise.all([
    document.fonts.load(`${FONT}px Hack`),
    document.fonts.load(`bold ${FONT}px Hack`)
  ]).then(() => {
    fontReady = true;
    measureCell();
  });
};

const hex = (v: number): string => '#' + (v & 0xffffff).toString(16).padStart(6, '0');

const keyToBytes = (e: React.KeyboardEvent): string | null => {
  const { key, ctrlKey, altKey, metaKey } = e;
  if (metaKey) return null;
  if (ctrlKey && !altKey && key.length === 1) {
    const u = key.toUpperCase();
    if (u >= 'A' && u <= 'Z') return String.fromCharCode(u.charCodeAt(0) - 64);
    if (u === ' ') return '\x00';
  }
  switch (key) {
    case 'Enter':
      return '\r';
    case 'Backspace':
      return '\x7f';
    case 'Tab':
      return '\t';
    case 'Escape':
      return '\x1b';
    case 'ArrowUp':
      return '\x1b[A';
    case 'ArrowDown':
      return '\x1b[B';
    case 'ArrowRight':
      return '\x1b[C';
    case 'ArrowLeft':
      return '\x1b[D';
    case 'Home':
      return '\x1b[H';
    case 'End':
      return '\x1b[F';
    case 'Delete':
      return '\x1b[3~';
    case 'PageUp':
      return '\x1b[5~';
    case 'PageDown':
      return '\x1b[6~';
    default:
      if (key.length === 1 && !ctrlKey) return altKey ? '\x1b' + key : key;
      return null;
  }
};

const GridTerminal = ({ tileId, cwd, cols, rows, active, visible, k }: GridTerminalProps) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const wsRef = React.useRef<WebSocket | null>(null);
  const frameRef = React.useRef<GridFrame | null>(null);
  const scrollRef = React.useRef(0);
  const dirtyRef = React.useRef(true);
  const blinkRef = React.useRef(true);
  const activeRef = React.useRef(active);
  const visibleRef = React.useRef(visible);
  const kRef = React.useRef(k);
  const colsRef = React.useRef(cols);
  const rowsRef = React.useRef(rows);
  activeRef.current = active;
  visibleRef.current = visible;
  kRef.current = k;
  colsRef.current = cols;
  rowsRef.current = rows;

  const draw = React.useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const frame = frameRef.current;
    if (!canvas || !ctx || !frame) return;
    if (!visibleRef.current) {
      if (canvas.width !== 1) {
        canvas.width = 1;
        canvas.height = 1;
        canvas.style.width = '0px';
        canvas.style.height = '0px';
      }
      return;
    }
    const nCols = frame.cols;
    const nRows = frame.rows;
    const w = nCols * cellW;
    const h = nRows * CELL_H;
    const scale = (window.devicePixelRatio || 1) * kRef.current;
    const bw = Math.ceil(w * scale);
    const bh = Math.ceil(h * scale);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);
    ctx.textBaseline = 'top';

    const lines = frame.lines;
    const attrs = frame.attrs;
    const yOff = (CELL_H - FONT) / 2;
    for (let r = 0; r < nRows; r++) {
      const line = lines[r] ?? '';
      const cells = Array.from(line);
      for (let c = 0; c < nCols; c++) {
        const i = (r * nCols + c) * 2;
        const w0 = attrs[i] ?? 0;
        const w1 = attrs[i + 1] ?? 0;
        if (w1 & 0x80000000) {
          ctx.fillStyle = hex(w1);
          ctx.fillRect(c * cellW, r * CELL_H, cellW + 0.5, CELL_H);
        }
        const ch = cells[c];
        if (ch && ch !== ' ') {
          ctx.font = `${w0 & (1 << 24) ? 'bold ' : ''}${FONT}px Hack, monospace`;
          ctx.fillStyle = hex(w0);
          ctx.fillText(ch, c * cellW, r * CELL_H + yOff);
        }
      }
    }

    if (activeRef.current && blinkRef.current && !frame.cursorHidden) {
      ctx.fillStyle = 'rgba(199,208,224,0.65)';
      ctx.fillRect(frame.cursorCol * cellW, frame.cursorRow * CELL_H, cellW, CELL_H);
    }
  }, []);

  React.useEffect(() => {
    let disposed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const target = getSetting(TERMINAL_TARGET_KEY, 'auto');
    measureCell();
    ensureFont().then(() => {
      if (!disposed) dirtyRef.current = true;
    });
    const paint = setInterval(() => {
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      draw();
    }, PAINT_MS);

    const connect = () => {
      if (disposed) return;
      const ws = openPtyConnection(
        { tileId, cwd, cols: colsRef.current, rows: rowsRef.current, target },
        {
          onGrid: (frame) => {
            frameRef.current = frame;
            scrollRef.current = frame.offset;
            dirtyRef.current = true;
          },
          onExit: () => {},
          onReady: () => {}
        }
      );
      wsRef.current = ws;
      ws.onclose = () => {
        if (!disposed) retry = setTimeout(() => scheduleConnect(connect, visibleRef.current ? 2 : 1), 2000);
      };
    };
    scheduleConnect(connect, visibleRef.current ? 2 : 0);

    return () => {
      disposed = true;
      clearInterval(paint);
      clearTimeout(retry);
      wsRef.current?.close();
      wsRef.current = null;
      frameRef.current = null;
    };
  }, [tileId, cwd, draw]);

  React.useEffect(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) sendPtyResize(ws, cols, rows);
  }, [cols, rows]);

  React.useEffect(() => {
    dirtyRef.current = true;
  }, [k, visible]);

  React.useEffect(() => {
    blinkRef.current = true;
    dirtyRef.current = true;
    if (!active) return;
    canvasRef.current?.focus();
    const id = setInterval(() => {
      blinkRef.current = !blinkRef.current;
      dirtyRef.current = true;
    }, 530);
    return () => clearInterval(id);
  }, [active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const ws = wsRef.current;
    if (!ws) return;
    const bytes = keyToBytes(e);
    if (bytes === null) return;
    e.preventDefault();
    blinkRef.current = true;
    sendPtyInput(ws, bytes);
  };

  const onWheel = (e: React.WheelEvent) => {
    if (!activeRef.current) return;
    const ws = wsRef.current;
    if (!ws) return;
    e.stopPropagation();
    const next = Math.max(0, scrollRef.current + (e.deltaY < 0 ? 3 : -3));
    if (next === scrollRef.current) return;
    scrollRef.current = next;
    sendPtyScroll(ws, next);
  };

  return <canvas ref={canvasRef} tabIndex={-1} onKeyDown={onKeyDown} onWheel={onWheel} className={styles.wasm} />;
};

export default GridTerminal;
