import React from 'react';
import { createPortal } from 'react-dom';
import { X, Maximize, ZoomIn, ZoomOut, RotateCw, RotateCcw } from 'lucide-react';

import { readTempImage } from '~/adapter/clipboard/clipboard.client';

import styles from './styles.module.scss';

interface MagnifierProps {
  path: string;
  onClose: () => void;
}

const MIN_SCALE = 0.1;
const MAX_SCALE = 20;
const clamp = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

const BACKDROP_STYLE: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 2147483000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden'
};

const Magnifier = ({ path, onClose }: MagnifierProps) => {
  const [src, setSrc] = React.useState<string | null>(null);
  const [scale, setScale] = React.useState(1);
  const [rotation, setRotation] = React.useState(0);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const dragRef = React.useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  React.useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    readTempImage(path)
      .then((u) => {
        if (cancelled) {
          URL.revokeObjectURL(u);
          return;
        }
        url = u;
        setSrc(u);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);

  const reset = () => {
    setScale(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  };
  const zoomIn = () => setScale((s) => clamp(s * 1.25));
  const zoomOut = () => setScale((s) => clamp(s / 1.25));
  const rotateLeft = () => setRotation((r) => r - 90);
  const rotateRight = () => setRotation((r) => r + 90);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        zoomIn();
      } else if (e.key === '-') {
        zoomOut();
      } else if (e.key === '0') {
        reset();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const onBackdropDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (e.target === e.currentTarget) onClose();
  };

  const onWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    setScale((s) => clamp(s * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
  };

  const onImgDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    dragRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onImgMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setPan({ x: d.px + (e.clientX - d.x), y: d.py + (e.clientY - d.y) });
  };
  const onImgUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    (e.target as Element).releasePointerCapture(e.pointerId);
  };
  const stopDown = (e: React.PointerEvent) => e.stopPropagation();

  return createPortal(
    <div className={styles.backdrop} style={BACKDROP_STYLE} onPointerDown={onBackdropDown} onWheel={onWheel}>
      {src && (
        <img
          src={src}
          alt=""
          draggable={false}
          className={styles.img}
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${scale})` }}
          onPointerUp={onImgUp}
          onPointerDown={onImgDown}
          onPointerMove={onImgMove}
        />
      )}
      <div className={styles.controls} onPointerDown={stopDown}>
        <button type="button" title="Zoom in (+)" onClick={zoomIn}>
          <ZoomIn size={16} />
        </button>
        <button type="button" title="Zoom out (-)" onClick={zoomOut}>
          <ZoomOut size={16} />
        </button>
        <button type="button" title="Rotate left" onClick={rotateLeft}>
          <RotateCcw size={16} />
        </button>
        <button type="button" title="Rotate right" onClick={rotateRight}>
          <RotateCw size={16} />
        </button>
        <button type="button" title="Reset (0)" onClick={reset}>
          <Maximize size={16} />
        </button>
        <button type="button" title="Close (Esc)" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
    </div>,
    document.body
  );
};

export default Magnifier;
