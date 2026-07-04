# Panorama

Infinite canvas of persistent terminal tiles: a Tauri shell over a native Rust
PTY sidecar.

## Run

```
bun install
bun run sidecar   # build the Rust sidecar binary (once, and after sidecar changes)
bun run dev
```

`bun run dev` runs `tauri dev`, which compiles the Rust shell, starts Vite, and
opens the window. On startup the Rust `setup` hook spawns the **sidecar**, a
detached native process (`sidecar-rs/`) that owns the PTYs and survives app
restarts. If the sidecar is already listening on port 9777 it is reused.

The sidecar is a separate Cargo crate; `tauri dev` does not build it. Run
`bun run sidecar` (`cargo build --manifest-path sidecar-rs/Cargo.toml`) before
the first launch and whenever the sidecar changes.

## What's here

- **Canvas** (`src/components/Canvas`): pan (drag empty space), zoom
  (ctrl+wheel), draggable/resizable grid-snapping tiles. Layout persisted per
  workspace. A tile only goes live once it is on screen and wide enough
  (`MIN_LIVE_WIDTH`); off-screen or tiny tiles render a placeholder while their
  shell keeps running in the sidecar.
- **Grid terminal** (`src/components/Terminal/GridTerminal.tsx`): one WebSocket
  per tile to the sidecar. The sidecar emulates the terminal and streams a
  ready-to-paint grid; the client renders it to a `<canvas>` and never emulates.
  Wheel over a focused tile scrolls its 5000-line scrollback.
- **Sidecar** (`sidecar-rs/`): native Rust PTY daemon. `portable-pty` spawns the
  shell, `vt100` emulates it server-side, and a hand-rolled WebSocket/HTTP server
  on port 9777 streams grid frames. One session per `tileId`; sessions persist
  across window reloads and app restarts (grid state lives in the daemon, so a
  reconnect just replays the current screen, no ring buffer). Shell spawns are
  bounded by a semaphore and held until first output to avoid a boot storm.

## Sidecar protocol

- `GET  /health` -> `ok`
- `GET  /kill?tileId=...` -> kill a session and its whole process tree
- `WS   /pty?tileId=...&cols=...&rows=...[&cwd=...][&target=...]`
  - server -> client: text `{t:"ready",cols,rows,reused}` / `{t:"exit"}`,
    binary = grid frame (header + scrollback offset + UTF-8 grid + per-cell attrs)
  - client -> server: text `{t:"in",d}` / `{t:"resize",cols,rows}` /
    `{t:"scroll",rows}` / `{t:"kill"}`
```
