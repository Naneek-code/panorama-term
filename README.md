# Panorama

Infinite canvas of persistent terminal tiles — a Tauri shell over a Bun PTY sidecar.

## Run

```
bun install
bun run dev
```

`bun run dev` runs `tauri dev`, which compiles the Rust shell, starts Vite, and
opens the window. On startup the Rust `setup` hook spawns the **sidecar** — a
detached Bun process (`sidecar/index.ts`) that owns the PTYs and survives app
restarts. If the sidecar is already listening on port 9777 it is reused.

## What's here

- **Canvas** (`src/Canvas.tsx`) — pan (drag empty space), zoom (ctrl+wheel),
  draggable terminal tiles. Layout persisted to `localStorage`.
- **Terminal tile** (`src/TerminalTile.tsx`) — xterm.js, one WebSocket per tile
  to the sidecar. On reconnect the sidecar replays the ring-buffer scrollback.
- **Sidecar** (`sidecar/index.ts`) — `Bun.serve` WebSocket PTY daemon
  (node-pty). One session per `tileId`; sessions persist across window reloads
  and app restarts. Ring buffer per session (1 MB) for scrollback replay.

## Sidecar protocol

- `GET  /health` → `ok`
- `GET  /sessions` → JSON list of live sessions
- `GET  /kill?tileId=…` → kill a session
- `WS   /pty?tileId=…&cols=…&rows=…[&cwd=…][&shell=…]`
  - server → client: text `{t:"ready",reused}` / `{t:"exit",exitCode}`, binary = PTY output
  - client → server: text `{t:"in",d}` / `{t:"resize",cols,rows}` / `{t:"kill"}`
