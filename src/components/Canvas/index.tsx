import TileFrame from '~/components/Canvas/TileFrame';
import { useCanvas } from '~/usecase/hooks/useCanvas';

import styles from './styles.module.scss';

const Canvas = () => {
  const {
    view,
    tiles,
    bgRef,
    endPan,
    gridRef,
    onWheel,
    addTile,
    moveTile,
    closeTile,
    resetZoom,
    indicatorRef,
    onBgPointerMove,
    onBgPointerDown
  } = useCanvas();

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <button className={styles.add} onClick={addTile}>
          + Terminal
        </button>
        <button className={styles.zoomReset} onClick={resetZoom}>
          {Math.round(view.k * 100)}%
        </button>
        <span className={styles.hint}>wheel to zoom · ctrl/shift+wheel or drag to pan · drag tile header to move</span>
      </div>
      <div
        ref={bgRef}
        className={styles.bg}
        onWheel={onWheel}
        onPointerUp={endPan}
        onPointerDown={onBgPointerDown}
        onPointerMove={onBgPointerMove}
        onPointerCancel={endPan}
      >
        <canvas ref={gridRef} className={styles.grid} />
        {tiles.map((t) => (
          <TileFrame key={t.id} tile={t} view={view} onMove={moveTile} onClose={closeTile} />
        ))}
        <div ref={indicatorRef} className={styles.indicator}>
          100%
        </div>
      </div>
    </div>
  );
};

export default Canvas;
