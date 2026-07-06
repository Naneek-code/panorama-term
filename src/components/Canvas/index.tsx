import React from 'react';
import { SquareDashed, SquareTerminal } from 'lucide-react';

import Frame from '~/components/Canvas/Frame';
import FrameBar from '~/components/Canvas/FrameBar';
import Minimap from '~/components/Canvas/Minimap';
import TileFrame from '~/components/Canvas/TileFrame';
import ContextMenu from '~/components/commons/ContextMenu';
import { useCanvas } from '~/usecase/hooks/useCanvas';
import { TILE_GAP, CULL_MARGIN, MIN_LIVE_WIDTH } from '~/usecase/util/constants';
import { useWorkspace } from '~/usecase/context/WorkspaceContext';

import styles from './styles.module.scss';

interface Menu {
  sx: number;
  sy: number;
  wx: number;
  wy: number;
}

const Canvas = () => {
  const { activeState, saveActiveState } = useWorkspace();
  const {
    view,
    tiles,
    panTo,
    bgRef,
    frames,
    endPan,
    addTile,
    addFrame,
    gridRef,
    focusTile,
    onWheel,
    moveTile,
    snapTile,
    dragFrame,
    closeTile,
    snapFrame,
    activeTile,
    resizeTile,
    removeFrame,
    renameFrame,
    resizeFrame,
    recolorFrame,
    activateTile,
    setTileCwd,
    indicatorRef,
    onBgPointerMove,
    onBgPointerDown
  } = useCanvas({ seed: activeState, onPersist: saveActiveState });

  const [menu, setMenu] = React.useState<Menu | null>(null);
  const [size, setSize] = React.useState({ w: window.innerWidth, h: window.innerHeight });
  const activated = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const inset = TILE_GAP / 2;
  const isVisible = (t: (typeof tiles)[number]): boolean => {
    const left = (t.x + inset) * view.k + view.x;
    const top = (t.y + inset) * view.k + view.y;
    const w = (t.width - TILE_GAP) * view.k;
    const h = (t.height - TILE_GAP) * view.k;
    return (
      left < size.w + CULL_MARGIN &&
      left + w > -CULL_MARGIN &&
      top < size.h + CULL_MARGIN &&
      top + h > -CULL_MARGIN
    );
  };

  const [receded, setReceded] = React.useState<Set<string>>(new Set());

  const focused = tiles.find((t) => t.id === activeTile) ?? null;

  const holds = (f: (typeof frames)[number]): boolean => {
    if (!focused) return false;
    const cx = focused.x + focused.width / 2;
    const cy = focused.y + focused.height / 2;
    return cx >= f.x && cx <= f.x + f.width && cy >= f.y && cy <= f.y + f.height;
  };

  React.useLayoutEffect(() => {
    const bg = bgRef.current;
    if (!bg) return;
    const tileEl = focused && bg.querySelector(`[data-tile="${focused.id}"]`);
    const next = new Set<string>();
    if (tileEl) {
      const tr = tileEl.getBoundingClientRect();
      for (const f of frames) {
        if (holds(f)) continue;
        const barEl = bg.querySelector(`[data-frame-bar="${f.id}"]`);
        if (!barEl) continue;
        const br = barEl.getBoundingClientRect();
        if (br.left < tr.right && br.right > tr.left && br.top < tr.bottom && br.bottom > tr.top) next.add(f.id);
      }
    }
    setReceded((prev) => (prev.size === next.size && [...prev].every((id) => next.has(id)) ? prev : next));
  });

  const closeMenu = () => setMenu(null);

  const openMenu = (e: React.MouseEvent) => {
    if ((e.target as Element).closest('[data-tile]')) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const wx = (e.clientX - rect.left - view.x) / view.k;
    const wy = (e.clientY - rect.top - view.y) / view.k;
    setMenu({ sx: e.clientX, sy: e.clientY, wx, wy });
  };

  const newTerminal = () => {
    if (menu) addTile({ x: menu.wx, y: menu.wy });
  };

  const newFrame = () => {
    if (menu) addFrame(menu.wx, menu.wy);
  };

  return (
    <div className={styles.root}>
      <div
        ref={bgRef}
        className={styles.bg}
        onWheel={onWheel}
        onPointerUp={endPan}
        onContextMenu={openMenu}
        onPointerDown={onBgPointerDown}
        onPointerMove={onBgPointerMove}
        onPointerCancel={endPan}
      >
        <canvas ref={gridRef} className={styles.grid} />
        {frames.map((f) => (
          <Frame key={f.id} frame={f} view={view} onSnap={snapFrame} onResize={resizeFrame} />
        ))}
        {tiles.map((t) => {
          const vis = isVisible(t);
          if (vis && (t.width - TILE_GAP) * view.k >= MIN_LIVE_WIDTH) activated.current.add(t.id);
          const live = activated.current.has(t.id);
          return (
            <TileFrame
              key={t.id}
              tile={t}
              view={view}
              onMove={moveTile}
              onSnap={snapTile}
              onClose={closeTile}
              onResize={resizeTile}
              onActivate={activateTile}
              onFocusTile={focusTile}
              onCwd={setTileCwd}
              active={t.id === activeTile}
              visible={vis}
              live={live}
            />
          );
        })}
        {frames.map((f) => (
          <FrameBar
            key={f.id}
            frame={f}
            view={view}
            tiles={tiles}
            recede={receded.has(f.id)}
            onDrag={dragFrame}
            onRemove={removeFrame}
            onRename={renameFrame}
            onRecolor={recolorFrame}
          />
        ))}
        <div ref={indicatorRef} className={styles.indicator}>
          100%
        </div>
        <Minimap view={view} tiles={tiles} viewportRef={bgRef} onPan={panTo} />
      </div>
      {menu && (
        <ContextMenu
          x={menu.sx}
          y={menu.sy}
          onClose={closeMenu}
          items={[
            { label: 'New terminal', icon: <SquareTerminal size={15} strokeWidth={1.75} />, onSelect: newTerminal },
            { label: 'New frame', icon: <SquareDashed size={15} strokeWidth={1.75} />, onSelect: newFrame }
          ]}
        />
      )}
    </div>
  );
};

export default Canvas;
