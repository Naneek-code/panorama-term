use std::collections::{HashMap, HashSet};
use std::io::{Read, Write};
use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicU16, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio_tungstenite::tungstenite::handshake::derive_accept_key;
use tokio_tungstenite::tungstenite::protocol::Role;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::WebSocketStream;

const PORT: u16 = 9777;
const DEFAULT_FG: u32 = 0xC7_D0_E0;
const DEFAULT_BG: u32 = 0x0B_0E_14;

const BASE16: [u32; 16] = [
    0x000000, 0xCD3131, 0x0DBC79, 0xE5E510, 0x2472C8, 0xBC3FBC, 0x11A8CD, 0xE5E5E5, 0x666666,
    0xF14C4C, 0x23D18B, 0xF5F543, 0x3B8EEA, 0xD670D6, 0x29B8DB, 0xE5E5E5,
];

fn idx_rgb(i: u8) -> u32 {
    match i {
        0..=15 => BASE16[i as usize],
        16..=231 => {
            let n = i - 16;
            let steps = [0u32, 95, 135, 175, 215, 255];
            let r = steps[(n / 36) as usize];
            let g = steps[((n / 6) % 6) as usize];
            let b = steps[(n % 6) as usize];
            (r << 16) | (g << 8) | b
        }
        _ => {
            let v = 8 + 10 * (i as u32 - 232);
            (v << 16) | (v << 8) | v
        }
    }
}

fn color_rgb(c: vt100::Color) -> Option<u32> {
    match c {
        vt100::Color::Default => None,
        vt100::Color::Idx(i) => Some(idx_rgb(i)),
        vt100::Color::Rgb(r, g, b) => Some(((r as u32) << 16) | ((g as u32) << 8) | b as u32),
    }
}

const SCROLLBACK_LINES: usize = 5000;

struct Session {
    tile_id: String,
    parser: Mutex<vt100::Parser>,
    writer: Mutex<Box<dyn Write + Send>>,
    master: Mutex<Box<dyn portable_pty::MasterPty + Send>>,
    child: Mutex<Box<dyn portable_pty::Child + Send + Sync>>,
    dirty: AtomicBool,
    exited: AtomicBool,
    cols: AtomicU16,
    rows: AtomicU16,
    scrollback: AtomicUsize,
}

fn sessions() -> &'static Mutex<HashMap<String, Arc<Session>>> {
    static S: OnceLock<Mutex<HashMap<String, Arc<Session>>>> = OnceLock::new();
    S.get_or_init(|| Mutex::new(HashMap::new()))
}

#[derive(Clone)]
struct Params {
    tile_id: String,
    cols: u16,
    rows: u16,
    cwd: Option<String>,
    shell: Option<String>,
    target: Option<String>,
}

fn default_shell() -> String {
    if cfg!(windows) {
        std::env::var("COMSPEC").unwrap_or_else(|_| "powershell.exe".into())
    } else {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".into())
    }
}

#[cfg(windows)]
fn hidden_command(program: &str) -> std::process::Command {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let mut c = std::process::Command::new(program);
    c.creation_flags(CREATE_NO_WINDOW);
    c
}

#[cfg(not(windows))]
fn hidden_command(program: &str) -> std::process::Command {
    std::process::Command::new(program)
}

fn command_exists(cmd: &str) -> bool {
    let finder = if cfg!(windows) { "where.exe" } else { "which" };
    hidden_command(finder)
        .arg(cmd)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

fn resolve_powershell() -> String {
    static CACHE: OnceLock<String> = OnceLock::new();
    CACHE
        .get_or_init(|| {
            if command_exists("pwsh.exe") {
                "pwsh.exe".into()
            } else {
                "powershell.exe".into()
            }
        })
        .clone()
}

fn resolve_target(target: Option<&str>) -> Option<String> {
    match target {
        None | Some("auto") | Some("") => {
            if cfg!(windows) {
                Some(resolve_powershell())
            } else {
                None
            }
        }
        Some("powershell") => Some(resolve_powershell()),
        _ => None,
    }
}

fn powershell_osc7_snippet() -> String {
    [
        "",
        "if ($env:PANORAMA_TERMINAL) {",
        "    $Global:__panoOldPrompt = $function:prompt",
        "    function prompt {",
        r"        $p = (Get-Location).ProviderPath -replace '\\', '/'",
        r#"        [Console]::Write("$([char]27)]7;file://$env:COMPUTERNAME/$p$([char]7)")"#,
        "        & $Global:__panoOldPrompt",
        "    }",
        "}",
        "",
    ]
    .join("\r\n")
}

fn ensure_powershell_profile_osc7(shell: &str) {
    if !cfg!(windows) {
        return;
    }
    static DONE: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();
    let done = DONE.get_or_init(|| Mutex::new(HashSet::new()));
    {
        let mut d = done.lock().unwrap();
        if d.contains(shell) {
            return;
        }
        d.insert(shell.to_string());
    }
    let shell = shell.to_string();
    std::thread::spawn(move || {
        let out = hidden_command(&shell)
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "$PROFILE.CurrentUserCurrentHost",
            ])
            .output();
        let out = match out {
            Ok(o) => o,
            Err(_) => return,
        };
        let profile_path = String::from_utf8_lossy(&out.stdout).trim().to_string();
        if profile_path.is_empty() {
            return;
        }
        let existing = std::fs::read_to_string(&profile_path).unwrap_or_default();
        if existing.contains("__panoOldPrompt") {
            return;
        }
        if let Some(parent) = Path::new(&profile_path).parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if let Ok(mut f) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&profile_path)
        {
            let _ = f.write_all(powershell_osc7_snippet().as_bytes());
        }
    });
}

fn osc7_shell_hook(shell: &str) -> Option<String> {
    let base = Path::new(shell)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase();
    if base == "zsh" {
        return Some(
            r#" __pano_osc7() { printf "\e]7;file://%s%s\a" "$HOST" "$PWD"; }; precmd_functions+=(__pano_osc7); clear"#
                .to_string(),
        );
    }
    if base == "bash" || base == "sh" {
        return Some(
            r#" PROMPT_COMMAND='printf "\e]7;file://%s%s\a" "$HOSTNAME" "$PWD"'${PROMPT_COMMAND:+";$PROMPT_COMMAND"}; clear"#
                .to_string(),
        );
    }
    None
}

fn inject_osc7(session: &Arc<Session>, shell: &str) {
    let base = Path::new(shell)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase();
    if base.starts_with("powershell") || base.starts_with("pwsh") {
        ensure_powershell_profile_osc7(shell);
        return;
    }
    if let Some(hook) = osc7_shell_hook(shell) {
        let s = session.clone();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(300));
            if s.exited.load(Ordering::Relaxed) {
                return;
            }
            if let Ok(mut w) = s.writer.lock() {
                let _ = w.write_all(hook.as_bytes());
                let _ = w.write_all(b"\n");
                let _ = w.flush();
            }
        });
    }
}

fn spawn_session(p: &Params, permit: tokio::sync::OwnedSemaphorePermit) -> Arc<Session> {
    let shell = resolve_target(p.target.as_deref())
        .or_else(|| p.shell.clone())
        .unwrap_or_else(default_shell);
    let cols = p.cols.max(2);
    let rows = p.rows.max(2);
    let cwd = p
        .cwd
        .clone()
        .or_else(|| std::env::var("USERPROFILE").ok())
        .or_else(|| std::env::var("HOME").ok())
        .unwrap_or_else(|| ".".into());

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .expect("openpty");

    let mut cmd = CommandBuilder::new(&shell);
    cmd.cwd(&cwd);
    cmd.env("TERM", "xterm-256color");
    cmd.env("PANORAMA_TERMINAL", "1");
    cmd.env("PANORAMA_TILE_ID", &p.tile_id);

    let child = pair.slave.spawn_command(cmd).expect("spawn");
    let reader = pair.master.try_clone_reader().expect("reader");
    let writer = pair.master.take_writer().expect("writer");
    drop(pair.slave);

    let session = Arc::new(Session {
        tile_id: p.tile_id.clone(),
        parser: Mutex::new(vt100::Parser::new(rows, cols, SCROLLBACK_LINES)),
        writer: Mutex::new(writer),
        master: Mutex::new(pair.master),
        child: Mutex::new(child),
        dirty: AtomicBool::new(true),
        exited: AtomicBool::new(false),
        cols: AtomicU16::new(cols),
        rows: AtomicU16::new(rows),
        scrollback: AtomicUsize::new(0),
    });

    let s = session.clone();
    std::thread::spawn(move || {
        let mut permit = Some(permit);
        let mut reader = reader;
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    permit.take();
                    if let Ok(mut parser) = s.parser.lock() {
                        parser.process(&buf[..n]);
                    }
                    s.dirty.store(true, Ordering::Relaxed);
                }
            }
        }
        s.exited.store(true, Ordering::Relaxed);
        s.dirty.store(true, Ordering::Relaxed);
        sessions().lock().unwrap().remove(&s.tile_id);
    });

    inject_osc7(&session, &shell);
    session
}

const MAX_CONCURRENT_BOOT: usize = 3;

fn spawn_sem() -> Arc<tokio::sync::Semaphore> {
    static SEM: OnceLock<Arc<tokio::sync::Semaphore>> = OnceLock::new();
    SEM.get_or_init(|| Arc::new(tokio::sync::Semaphore::new(MAX_CONCURRENT_BOOT)))
        .clone()
}

fn lookup_live(tile_id: &str) -> Option<Arc<Session>> {
    let map = sessions().lock().unwrap();
    map.get(tile_id)
        .filter(|s| !s.exited.load(Ordering::Relaxed))
        .cloned()
}

async fn get_or_create(p: &Params) -> Option<(Arc<Session>, bool)> {
    if let Some(s) = lookup_live(&p.tile_id) {
        return Some((s, true));
    }
    let permit = spawn_sem().acquire_owned().await.ok()?;
    if let Some(s) = lookup_live(&p.tile_id) {
        return Some((s, true));
    }
    let params = p.clone();
    let s = tokio::task::spawn_blocking(move || spawn_session(&params, permit))
        .await
        .ok()?;
    sessions().lock().unwrap().insert(p.tile_id.clone(), s.clone());
    Some((s, false))
}

fn resize_session(s: &Session, cols: u16, rows: u16) {
    let cols = cols.max(2);
    let rows = rows.max(2);
    if s.cols.load(Ordering::Relaxed) == cols && s.rows.load(Ordering::Relaxed) == rows {
        return;
    }
    s.cols.store(cols, Ordering::Relaxed);
    s.rows.store(rows, Ordering::Relaxed);
    if let Ok(master) = s.master.lock() {
        let _ = master.resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        });
    }
    if let Ok(mut parser) = s.parser.lock() {
        parser.set_size(rows, cols);
    }
    s.dirty.store(true, Ordering::Relaxed);
}

fn kill_session(s: &Arc<Session>) {
    let s = s.clone();
    std::thread::spawn(move || {
        #[cfg(windows)]
        {
            let pid = s.child.lock().ok().and_then(|c| c.process_id());
            if let Some(pid) = pid {
                let _ = hidden_command("taskkill.exe")
                    .args(["/PID", &pid.to_string(), "/T", "/F"])
                    .status();
            }
        }
        if let Ok(mut c) = s.child.lock() {
            let _ = c.kill();
        }
        s.exited.store(true, Ordering::Relaxed);
        sessions().lock().unwrap().remove(&s.tile_id);
    });
}

fn build_frame(s: &Session) -> Vec<u8> {
    let mut parser = s.parser.lock().unwrap();
    parser.set_scrollback(s.scrollback.load(Ordering::Relaxed));
    let screen = parser.screen();
    let offset = screen.scrollback() as u16;
    let (rows, cols) = screen.size();

    let mut text = String::with_capacity(rows as usize * (cols as usize + 1));
    let mut attrs: Vec<u32> = Vec::with_capacity(rows as usize * cols as usize * 2);
    for r in 0..rows {
        for c in 0..cols {
            let cell = screen.cell(r, c);
            match cell {
                Some(cell) if !cell.contents().is_empty() => text.push_str(&cell.contents()),
                _ => text.push(' '),
            }
            let (mut fg, mut bg, mut flags) = (DEFAULT_FG, None::<u32>, 0u32);
            if let Some(cell) = cell {
                fg = color_rgb(cell.fgcolor()).unwrap_or(DEFAULT_FG);
                bg = color_rgb(cell.bgcolor());
                if cell.bold() {
                    flags |= 1;
                }
                if cell.italic() {
                    flags |= 2;
                }
                if cell.underline() {
                    flags |= 4;
                }
                if cell.inverse() {
                    let real_bg = bg.unwrap_or(DEFAULT_BG);
                    bg = Some(fg);
                    fg = real_bg;
                }
            }
            attrs.push((fg & 0x00FF_FFFF) | (flags << 24));
            attrs.push(match bg {
                Some(rgb) => (rgb & 0x00FF_FFFF) | 0x8000_0000,
                None => 0,
            });
        }
        if r + 1 < rows {
            text.push('\n');
        }
    }

    let (cur_r, cur_c) = screen.cursor_position();
    let cursor = ((cur_r as u32) << 16) | (cur_c as u32);
    let hidden = screen.hide_cursor();
    drop(parser);

    let text_bytes = text.as_bytes();
    let mut buf = Vec::with_capacity(16 + text_bytes.len() + attrs.len() * 4);
    buf.push(1u8);
    buf.extend_from_slice(&rows.to_le_bytes());
    buf.extend_from_slice(&cols.to_le_bytes());
    buf.extend_from_slice(&cursor.to_le_bytes());
    buf.push(if hidden { 1 } else { 0 });
    buf.extend_from_slice(&offset.to_le_bytes());
    buf.extend_from_slice(&(text_bytes.len() as u32).to_le_bytes());
    buf.extend_from_slice(text_bytes);
    for w in &attrs {
        buf.extend_from_slice(&w.to_le_bytes());
    }
    buf
}

fn handle_client_msg(s: &Arc<Session>, text: &str) {
    let v: serde_json::Value = match serde_json::from_str(text) {
        Ok(v) => v,
        Err(_) => return,
    };
    match v.get("t").and_then(|t| t.as_str()) {
        Some("in") => {
            if let Some(d) = v.get("d").and_then(|d| d.as_str()) {
                s.scrollback.store(0, Ordering::Relaxed);
                s.dirty.store(true, Ordering::Relaxed);
                if let Ok(mut w) = s.writer.lock() {
                    let _ = w.write_all(d.as_bytes());
                    let _ = w.flush();
                }
            }
        }
        Some("scroll") => {
            let rows = v.get("rows").and_then(|r| r.as_u64()).unwrap_or(0) as usize;
            s.scrollback.store(rows.min(SCROLLBACK_LINES), Ordering::Relaxed);
            s.dirty.store(true, Ordering::Relaxed);
        }
        Some("resize") => {
            let cols = v.get("cols").and_then(|c| c.as_u64()).unwrap_or(0) as u16;
            let rows = v.get("rows").and_then(|r| r.as_u64()).unwrap_or(0) as u16;
            if cols >= 2 && rows >= 2 {
                resize_session(s, cols, rows);
            }
        }
        Some("kill") => kill_session(s),
        _ => {}
    }
}

async fn handle_ws(ws: WebSocketStream<TcpStream>, params: Params) {
    let (mut tx, mut rx) = ws.split();
    let (session, reused) = match get_or_create(&params).await {
        Some(v) => v,
        None => return,
    };
    resize_session(&session, params.cols, params.rows);

    let ready = format!(
        "{{\"t\":\"ready\",\"cols\":{},\"rows\":{},\"reused\":{}}}",
        session.cols.load(Ordering::Relaxed),
        session.rows.load(Ordering::Relaxed),
        reused
    );
    if tx.send(Message::Text(ready)).await.is_err() {
        return;
    }
    if tx
        .send(Message::Binary(build_frame(&session)))
        .await
        .is_err()
    {
        return;
    }
    session.dirty.store(false, Ordering::Relaxed);

    let mut tick = tokio::time::interval(Duration::from_millis(33));
    loop {
        tokio::select! {
            _ = tick.tick() => {
                if session.exited.load(Ordering::Relaxed) {
                    let _ = tx.send(Message::Text("{\"t\":\"exit\"}".into())).await;
                    break;
                }
                if session.dirty.swap(false, Ordering::Relaxed) {
                    if tx.send(Message::Binary(build_frame(&session))).await.is_err() {
                        break;
                    }
                }
            }
            msg = rx.next() => {
                match msg {
                    Some(Ok(Message::Text(t))) => handle_client_msg(&session, &t),
                    Some(Ok(Message::Binary(b))) => {
                        if let Ok(mut w) = session.writer.lock() {
                            let _ = w.write_all(&b);
                            let _ = w.flush();
                        }
                    }
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Err(_)) => break,
                    _ => {}
                }
            }
        }
    }
}

async fn read_head(stream: &mut TcpStream) -> Option<Vec<u8>> {
    let mut buf = Vec::with_capacity(1024);
    let mut byte = [0u8; 1];
    loop {
        match stream.read(&mut byte).await {
            Ok(0) => return None,
            Ok(_) => {
                buf.push(byte[0]);
                if buf.ends_with(b"\r\n\r\n") {
                    return Some(buf);
                }
                if buf.len() > 16384 {
                    return None;
                }
            }
            Err(_) => return None,
        }
    }
}

fn parse_head(head: &[u8]) -> (String, HashMap<String, String>) {
    let text = String::from_utf8_lossy(head);
    let mut lines = text.split("\r\n");
    let first = lines.next().unwrap_or("");
    let path = first.split_whitespace().nth(1).unwrap_or("/").to_string();
    let mut headers = HashMap::new();
    for line in lines {
        if line.is_empty() {
            break;
        }
        if let Some((k, v)) = line.split_once(':') {
            headers.insert(k.trim().to_ascii_lowercase(), v.trim().to_string());
        }
    }
    (path, headers)
}

fn hex_val(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(b - b'a' + 10),
        b'A'..=b'F' => Some(b - b'A' + 10),
        _ => None,
    }
}

fn percent_decode(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' && i + 2 < b.len() {
            if let (Some(h), Some(l)) = (hex_val(b[i + 1]), hex_val(b[i + 2])) {
                out.push(h * 16 + l);
                i += 3;
                continue;
            }
        }
        out.push(b[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn parse_query(query: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();
    for pair in query.split('&') {
        if let Some((k, v)) = pair.split_once('=') {
            map.insert(k.to_string(), percent_decode(v));
        }
    }
    map
}

async fn handle_conn(mut stream: TcpStream) {
    let head = match read_head(&mut stream).await {
        Some(h) => h,
        None => return,
    };
    let (path, headers) = parse_head(&head);
    let (path_only, query) = match path.split_once('?') {
        Some((p, q)) => (p, q),
        None => (path.as_str(), ""),
    };
    let is_ws = headers
        .get("upgrade")
        .map(|v| v.eq_ignore_ascii_case("websocket"))
        .unwrap_or(false);

    if is_ws && path_only == "/pty" {
        let key = match headers.get("sec-websocket-key") {
            Some(k) => k.clone(),
            None => return,
        };
        let accept = derive_accept_key(key.as_bytes());
        let resp = format!(
            "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: {accept}\r\n\r\n"
        );
        if stream.write_all(resp.as_bytes()).await.is_err() {
            return;
        }
        let q = parse_query(query);
        let tile_id = match q.get("tileId") {
            Some(t) if !t.is_empty() => t.clone(),
            _ => return,
        };
        let params = Params {
            tile_id,
            cols: q.get("cols").and_then(|c| c.parse().ok()).unwrap_or(80),
            rows: q.get("rows").and_then(|r| r.parse().ok()).unwrap_or(24),
            cwd: q.get("cwd").cloned(),
            shell: q.get("shell").cloned(),
            target: q.get("target").cloned(),
        };
        let ws = WebSocketStream::from_raw_socket(stream, Role::Server, None).await;
        handle_ws(ws, params).await;
        return;
    }

    let body = if path_only == "/kill" {
        let q = parse_query(query);
        if let Some(tid) = q.get("tileId") {
            let s = sessions().lock().unwrap().get(tid).cloned();
            if let Some(s) = s {
                kill_session(&s);
            }
        }
        "ok"
    } else if path_only == "/health" {
        "ok"
    } else {
        "panorama sidecar"
    };
    let resp = format!(
        "HTTP/1.1 200 OK\r\nAccess-Control-Allow-Origin: *\r\nContent-Type: text/plain\r\nContent-Length: {}\r\n\r\n{}",
        body.len(),
        body
    );
    let _ = stream.write_all(resp.as_bytes()).await;
}

#[tokio::main]
async fn main() {
    let listener = TcpListener::bind(("127.0.0.1", PORT))
        .await
        .expect("bind 9777");
    loop {
        match listener.accept().await {
            Ok((stream, _)) => {
                let _ = stream.set_nodelay(true);
                tokio::spawn(handle_conn(stream));
            }
            Err(_) => continue,
        }
    }
}
