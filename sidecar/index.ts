import * as pty from "node-pty";
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";

const PORT = 9777;
const RING_BYTES = 1 << 20;

type Session = {
  tileId: string;
  proc: pty.IPty;
  ring: Buffer[];
  ringLen: number;
  ws: WebSocket | null;
  createdAt: number;
  shell: string;
  cwd: string;
  exited: boolean;
};

const sessions = new Map<string, Session>();

process.on("uncaughtException", (e) => console.error("[sidecar] uncaught:", e));
process.on("unhandledRejection", (e) => console.error("[sidecar] unhandled:", e));

const clamp = (n: number, min: number) => (Number.isFinite(n) && n >= min ? Math.floor(n) : min);

function defaultShell(): string {
  if (process.platform === "win32") return process.env.COMSPEC || "powershell.exe";
  return process.env.SHELL || "/bin/bash";
}

function ringPush(s: Session, data: Buffer): void {
  s.ring.push(data);
  s.ringLen += data.length;
  while (s.ringLen > RING_BYTES && s.ring.length > 1) {
    s.ringLen -= s.ring[0]!.length;
    s.ring.shift();
  }
}

type WsData = { tileId: string; cols: number; rows: number; cwd?: string; shell?: string };

function getOrCreate(d: WsData): Session {
  const existing = sessions.get(d.tileId);
  if (existing && !existing.exited) return existing;

  const shell = d.shell || defaultShell();
  const cols = clamp(d.cols, 2);
  const rows = clamp(d.rows, 2);
  const cwd = d.cwd || process.env.HOME || process.env.USERPROFILE || process.cwd();
  console.error(`[sidecar] spawn tile=${d.tileId} shell=${shell} cols=${cols} rows=${rows} cwd=${cwd}`);
  const proc = pty.spawn(shell, [], {
    name: "xterm-256color",
    cols,
    rows,
    cwd,
    useConpty: true,
    env: { ...process.env, TERM: "xterm-256color", PANORAMA_TILE_ID: d.tileId } as Record<string, string>,
  });

  const s: Session = {
    tileId: d.tileId,
    proc,
    ring: [],
    ringLen: 0,
    ws: null,
    createdAt: Date.now(),
    shell,
    cwd,
    exited: false,
  };

  proc.onData((chunk) => {
    const buf = Buffer.from(chunk as unknown as Uint8Array);
    ringPush(s, buf);
    if (s.ws && s.ws.readyState === WebSocket.OPEN) s.ws.send(buf);
  });

  proc.onExit(({ exitCode }) => {
    console.error(`[sidecar] exit tile=${s.tileId} code=${exitCode}`);
    s.exited = true;
    if (s.ws && s.ws.readyState === WebSocket.OPEN) {
      s.ws.send(JSON.stringify({ t: "exit", exitCode }));
    }
    sessions.delete(s.tileId);
  });

  sessions.set(d.tileId, s);
  return s;
}

function killSession(s: Session): void {
  sessions.delete(s.tileId);
  if (s.exited) return;
  const proc = s.proc;
  try { proc.write(String.fromCharCode(3)); } catch {}
  try { proc.write("exit\r"); } catch {}
  setTimeout(() => {
    if (s.exited) return;
    try { proc.kill(); } catch {}
  }, 1500);
}

const server = createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
  if (url.pathname === "/health") return void res.end("ok");
  if (url.pathname === "/kill") {
    const tileId = url.searchParams.get("tileId");
    const s = tileId ? sessions.get(tileId) : undefined;
    if (s) killSession(s);
    return void res.end("ok");
  }
  if (url.pathname === "/sessions") {
    res.setHeader("content-type", "application/json");
    return void res.end(
      JSON.stringify(
        [...sessions.values()].map((s) => ({
          tileId: s.tileId,
          shell: s.shell,
          pid: s.proc.pid,
          createdAt: s.createdAt,
        })),
      ),
    );
  }
  res.end("panorama sidecar");
});

const wss = new WebSocketServer({ server, path: "/pty" });

wss.on("connection", (ws, req) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
  const tileId = url.searchParams.get("tileId");
  if (!tileId) return void ws.close();
  const d: WsData = {
    tileId,
    cols: Number(url.searchParams.get("cols") || 80),
    rows: Number(url.searchParams.get("rows") || 24),
    cwd: url.searchParams.get("cwd") || undefined,
    shell: url.searchParams.get("shell") || undefined,
  };

  const s = getOrCreate(d);
  if (s.ws && s.ws !== ws && s.ws.readyState === WebSocket.OPEN) {
    try { s.ws.close(); } catch {}
  }
  s.ws = ws;
  if (!s.exited) {
    try { s.proc.resize(clamp(d.cols, 2), clamp(d.rows, 2)); } catch (e) {
      console.error("[sidecar] resize failed:", (e as Error).message);
    }
  }

  const reused = s.ringLen > 0;
  ws.send(JSON.stringify({ t: "ready", tileId: s.tileId, pid: s.proc.pid, reused }));
  if (reused) ws.send(Buffer.concat(s.ring, s.ringLen));

  ws.on("message", (data: Buffer, isBinary: boolean) => {
    if (s.exited) return;
    try {
      if (!isBinary) {
        let m: { t?: string; d?: string; cols?: number; rows?: number };
        try { m = JSON.parse(data.toString()); } catch { return; }
        if (m.t === "in" && typeof m.d === "string") s.proc.write(m.d);
        else if (m.t === "resize" && m.cols && m.rows) s.proc.resize(clamp(m.cols, 2), clamp(m.rows, 2));
        else if (m.t === "kill") killSession(s);
      } else {
        s.proc.write(data.toString());
      }
    } catch (e) {
      console.error("[sidecar] pty op failed:", (e as Error).message);
    }
  });

  ws.on("close", () => {
    if (s.ws === ws) s.ws = null;
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[sidecar] pty daemon on ws://127.0.0.1:${PORT}`);
});
