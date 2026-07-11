import React from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Plus,
  Code,
  Globe,
  Image,
  Layers,
  Search,
  Trash2,
  Pencil,
  Network,
  GitBranch,
  Crosshair,
  FolderTree,
  StickyNote,
  FolderOpen,
  ChevronRight,
  ClipboardCopy,
  PanelLeftClose,
  SquareTerminal
} from 'lucide-react';

import type { Tile, Frame } from '~/domain/interfaces/canvas.interface';
import type { TileType } from '~/domain/interfaces/workspace.interface';
import type { DirEntry } from '~/adapter/fs/fs.client';
import type { NotifyKind } from '~/components/commons/Notifications/bridge';
import GitTab from '~/components/Canvas/Navigator/GitTab';
import FileTree from '~/components/Canvas/Navigator/FileTree';
import ContextMenu from '~/components/commons/ContextMenu';
import { tileLabel } from '~/usecase/util/title';
import { groupByFrame } from '~/usecase/util/frame';
import { revealPath } from '~/adapter/shell/shell.client';
import { writeClipboard } from '~/adapter/clipboard/clipboard.client';

import styles from './styles.module.scss';

const TYPE_ICON: Record<TileType, { Icon: LucideIcon; color: string }> = {
  term: { Icon: SquareTerminal, color: '#7aab6e' },
  note: { Icon: StickyNote, color: '#8a7aab' },
  code: { Icon: Code, color: '#7a8aab' },
  image: { Icon: Image, color: '#c07a6e' },
  graph: { Icon: Network, color: '#c8a35a' },
  browser: { Icon: Globe, color: '#5c9bcf' }
};

interface Menu {
  x: number;
  y: number;
  tile?: Tile;
  entry?: DirEntry;
}

interface NavigatorProps {
  tiles: Tile[];
  frames: Frame[];
  activeTile: string | null;
  alerts: Map<string, NotifyKind>;
  onNewTile: () => void;
  onFocusTile: (id: string, zoomToMax?: boolean) => void;
  onFocusFrame: (id: string) => void;
  onRenameTile: (id: string, title: string) => void;
  onCloseTile: (id: string) => void;
  onClose: () => void;
}

const WIDTH_KEY = 'panorama:navWidth';
const MIN_WIDTH = 200;
const MAX_WIDTH = 560;

const savedWidth = (): number => {
  const raw = Number(localStorage.getItem(WIDTH_KEY));
  return raw >= MIN_WIDTH && raw <= MAX_WIDTH ? raw : 248;
};

const Navigator = ({
  tiles,
  frames,
  activeTile,
  alerts,
  onNewTile,
  onFocusTile,
  onFocusFrame,
  onRenameTile,
  onCloseTile,
  onClose
}: NavigatorProps) => {
  const [tab, setTab] = React.useState<'files' | 'tiles' | 'git'>('files');
  const [width, setWidth] = React.useState(savedWidth);
  const [query, setQuery] = React.useState('');
  const [collapsed, setCollapsed] = React.useState<Set<string>>(() => new Set());
  const [renaming, setRenaming] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState('');
  const [menu, setMenu] = React.useState<Menu | null>(null);

  const needle = query.trim().toLowerCase();
  const { members, loose } = React.useMemo(() => groupByFrame(frames, tiles), [frames, tiles]);

  const cwd = tiles.find((t) => t.id === activeTile)?.cwd ?? null;
  const lastCwd = React.useRef<string | null>(null);
  if (cwd) lastCwd.current = cwd;
  const root = cwd ?? lastCwd.current;

  const matches = (tile: Tile): boolean => !needle || tileLabel(tile).toLowerCase().includes(needle);

  const onQuery = (e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value);

  const newTile = () => onNewTile();

  const showTiles = () => setTab('tiles');
  const showFiles = () => setTab('files');
  const showGit = () => setTab('git');

  const toggleFrame = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startRename = (tile: Tile) => {
    setDraft(tile.userTitle || tileLabel(tile));
    setRenaming(tile.id);
  };

  const commitRename = () => {
    if (renaming) onRenameTile(renaming, draft.trim());
    setRenaming(null);
  };

  const onRenameKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') setRenaming(null);
  };

  const openTileMenu = (e: React.MouseEvent, tile: Tile) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, tile });
  };

  const openFileMenu = (e: React.MouseEvent, entry: DirEntry) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, entry });
  };

  const closeMenu = () => setMenu(null);

  const startResize = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const el = e.currentTarget;
    const startX = e.clientX;
    const startW = width;
    let next = startW;
    el.setPointerCapture(e.pointerId);

    const move = (ev: PointerEvent) => {
      next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startW + ev.clientX - startX));
      setWidth(next);
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      localStorage.setItem(WIDTH_KEY, String(next));
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };

  const menuItems = () => {
    if (menu?.tile) {
      const tile = menu.tile;
      return [
        { label: 'Rename', icon: <Pencil size={15} strokeWidth={1.75} />, onSelect: () => startRename(tile) },
        { label: 'Focus', icon: <Crosshair size={15} strokeWidth={1.75} />, onSelect: () => onFocusTile(tile.id, true) },
        {
          label: 'Reveal in explorer',
          icon: <FolderOpen size={15} strokeWidth={1.75} />,
          onSelect: () => tile.cwd && revealPath(tile.cwd),
          disabled: !tile.cwd
        },
        { label: 'Close', icon: <Trash2 size={15} strokeWidth={1.75} />, danger: true, onSelect: () => onCloseTile(tile.id) }
      ];
    }
    if (menu?.entry) {
      const entry = menu.entry;
      return [
        { label: 'Open', icon: <FolderOpen size={15} strokeWidth={1.75} />, onSelect: () => revealPath(entry.path) },
        {
          label: 'Copy path',
          icon: <ClipboardCopy size={15} strokeWidth={1.75} />,
          onSelect: () => writeClipboard(entry.path)
        }
      ];
    }
    return [];
  };

  const row = (tile: Tile, nested: boolean) => {
    const { Icon, color } = TYPE_ICON[tile.type] ?? TYPE_ICON.term;
    const select = () => onFocusTile(tile.id);
    const zoom = () => onFocusTile(tile.id, true);
    const contextMenu = (e: React.MouseEvent) => openTileMenu(e, tile);

    return (
      <div
        key={tile.id}
        className={styles.tile}
        onClick={select}
        onDoubleClick={zoom}
        onContextMenu={contextMenu}
        data-nested={nested || undefined}
        data-active={tile.id === activeTile || undefined}
      >
        <Icon size={13} strokeWidth={1.75} style={{ color }} className={styles.icon} />
        {renaming === tile.id ? (
          <input
            autoFocus
            className={styles.rename}
            value={draft}
            onBlur={commitRename}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onRenameKey}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={styles.name}>{tileLabel(tile)}</span>
        )}
        {alerts.has(tile.id) && <span className={styles.dot} />}
      </div>
    );
  };

  return (
    <div className={styles.panel} style={{ width }}>
      <div className={styles.header}>
        <button className={styles.action} onClick={newTile} aria-label="New terminal">
          <Plus size={14} strokeWidth={2} />
        </button>
        <button className={styles.action} onClick={onClose} title="Close menu" aria-label="Close menu">
          <PanelLeftClose size={14} strokeWidth={1.75} />
        </button>
      </div>

      <div className={styles.tabs}>
        <button className={styles.tab} onClick={showFiles} data-active={tab === 'files' || undefined}>
          <FolderTree size={12} strokeWidth={2} />
          Files
        </button>
        <button className={styles.tab} onClick={showTiles} data-active={tab === 'tiles' || undefined}>
          <Layers size={12} strokeWidth={2} />
          Tiles
        </button>
        <button className={styles.tab} onClick={showGit} data-active={tab === 'git' || undefined}>
          <GitBranch size={12} strokeWidth={2} />
          Git
        </button>
      </div>

      {tab !== 'git' && (
        <div className={styles.filter}>
          <Search size={12} strokeWidth={2} />
          <input value={query} onChange={onQuery} placeholder="Filter" />
        </div>
      )}

      {tab === 'git' &&
        (root ? (
          <GitTab key={root} root={root} query="" />
        ) : (
          <div className={styles.empty}>Focus a terminal to see its repo</div>
        ))}

      <div className={styles.body} style={{ display: tab === 'git' ? 'none' : undefined }}>
        {tab === 'tiles' && (
          <>
            {frames.map((frame) => {
              const children = (members.get(frame.id) ?? []).filter(matches);
              const shut = collapsed.has(frame.id);
              const alerted = children.some((c) => alerts.has(c.id));
              const toggle = () => toggleFrame(frame.id);
              const goto = (e: React.MouseEvent) => {
                e.stopPropagation();
                onFocusFrame(frame.id);
              };

              return (
                <div key={frame.id}>
                  <div className={styles.group} onClick={toggle}>
                    <ChevronRight size={12} strokeWidth={2.5} className={styles.caret} data-open={!shut || undefined} />
                    <span className={styles.swatch} style={{ background: frame.color }} />
                    <span className={styles.name}>{frame.title}</span>
                    {alerted && <span className={styles.dot} />}
                    <span className={styles.count}>{children.length}</span>
                    <button className={styles.goto} onClick={goto} aria-label="Go to frame">
                      <Crosshair size={12} strokeWidth={2} />
                    </button>
                  </div>
                  {!shut && children.map((tile) => row(tile, true))}
                </div>
              );
            })}
            {loose.filter(matches).map((tile) => row(tile, false))}
            {tiles.length === 0 && <div className={styles.empty}>No tiles on canvas</div>}
          </>
        )}

        {tab === 'files' &&
          (root ? (
            <FileTree key={root} root={root} query={needle} onOpen={revealPath} onMenu={openFileMenu} />
          ) : (
            <div className={styles.empty}>Focus a terminal to see its folder</div>
          ))}
      </div>

      <div className={styles.resizer} onPointerDown={startResize} />

      {menu && <ContextMenu x={menu.x} y={menu.y} onClose={closeMenu} items={menuItems()} />}
    </div>
  );
};

export default Navigator;
