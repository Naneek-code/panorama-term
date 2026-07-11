import type { PaneApi, ChunkKind, DiffChunk } from '~/domain/interfaces/diff.interface';

import React from 'react';

import { SKIP_HEIGHT } from '~/usecase/util/diff';

import styles from './styles.module.scss';

interface SquiggleProps {
  orig: PaneApi;
  mod: PaneApi;
  chunks: DiffChunk[];
  centerRef: React.RefObject<HTMLDivElement | null>;
}

interface Shape {
  kind: ChunkKind;
  origStartY: number;
  origEndY: number;
  modStartY: number;
  modEndY: number;
}

interface Skip {
  origY: number;
  modY: number;
}

interface Geom {
  shapes: Shape[];
  skips: Skip[];
  leftX: number;
  rightX: number;
  width: number;
  height: number;
}

const FILL: Record<ChunkKind, string> = {
  modify: 'rgba(123, 166, 220, 0.2)',
  insert: 'rgba(128, 184, 122, 0.2)',
  delete: 'rgba(217, 124, 124, 0.2)'
};

const STROKE: Record<ChunkKind, string> = {
  modify: 'rgba(123, 166, 220, 0.7)',
  insert: 'rgba(128, 184, 122, 0.7)',
  delete: 'rgba(217, 124, 124, 0.7)'
};

const WAVE_AMP = 2;
const WAVE_PERIOD = 8;
const SKIP_STROKE = 'rgba(200, 200, 200, 0.35)';

const sigmoid = (x1: number, y1: number, x2: number, y2: number): string => {
  const mid = (x1 + x2) / 2;
  return `C ${mid.toFixed(2)} ${y1.toFixed(2)}, ${mid.toFixed(2)} ${y2.toFixed(2)}, ${x2.toFixed(2)} ${y2.toFixed(2)}`;
};

const wavy = (x1: number, y: number, x2: number): string => {
  if (x2 <= x1 + 0.5) return '';

  const len = x2 - x1;
  const steps = Math.max(8, Math.ceil(len / 2));
  const out: string[] = [];

  for (let i = 1; i <= steps; i++) {
    const x = x1 + len * (i / steps);
    const wave = Math.sin(((x - x1) / WAVE_PERIOD) * Math.PI * 2) * WAVE_AMP;
    out.push(`L ${x.toFixed(2)} ${(y + wave).toFixed(2)}`);
  }

  return out.join(' ');
};

const Squiggle = ({ orig, mod, chunks, centerRef }: SquiggleProps) => {
  const boxRef = React.useRef<HTMLDivElement>(null);
  const [geom, setGeom] = React.useState<Geom | null>(null);

  React.useEffect(() => {
    let raf = 0;

    const compute = () => {
      const box = boxRef.current;
      const origEl = orig.getElement();
      const modEl = mod.getElement();
      if (!box || !origEl || !modEl) return;

      const boxRect = box.getBoundingClientRect();
      const origRect = origEl.getBoundingClientRect();
      const modRect = modEl.getBoundingClientRect();
      const origScroll = orig.getScrollTop();
      const modScroll = mod.getScrollTop();
      const center = centerRef.current?.getBoundingClientRect();

      const leftX = center ? center.left - boxRect.left : origRect.right - boxRect.left;
      const rightX = center ? center.right - boxRect.left : modRect.left - boxRect.left;

      const yOrig = (line: number) => orig.getTopForLine(line) - origScroll + (origRect.top - boxRect.top);
      const yMod = (line: number) => mod.getTopForLine(line) - modScroll + (modRect.top - boxRect.top);

      const shapes = chunks.map((c) => {
        if (c.kind === 'insert') {
          const anchor = yOrig(c.origStart);
          return { kind: c.kind, origStartY: anchor, origEndY: anchor, modStartY: yMod(c.modStart), modEndY: yMod(c.modEnd) };
        }
        if (c.kind === 'delete') {
          const anchor = yMod(c.modStart);
          return { kind: c.kind, origStartY: yOrig(c.origStart), origEndY: yOrig(c.origEnd), modStartY: anchor, modEndY: anchor };
        }
        return {
          kind: c.kind,
          origStartY: yOrig(c.origStart),
          origEndY: yOrig(c.origEnd),
          modStartY: yMod(c.modStart),
          modEndY: yMod(c.modEnd)
        };
      });

      const origRows = orig.getRows();
      const modRows = mod.getRows();
      const origSkips = origRows.flatMap((r, i) => (r.kind === 'skip' ? [i] : []));
      const modSkips = modRows.flatMap((r, i) => (r.kind === 'skip' ? [i] : []));
      const half = SKIP_HEIGHT / 2;
      const skips: Skip[] = [];

      for (let i = 0; i < Math.min(origSkips.length, modSkips.length); i++) {
        skips.push({
          origY: orig.getRowTop(origSkips[i]) - origScroll + (origRect.top - boxRect.top) + half,
          modY: mod.getRowTop(modSkips[i]) - modScroll + (modRect.top - boxRect.top) + half
        });
      }

      setGeom({ shapes, skips, leftX, rightX, width: boxRect.width, height: boxRect.height });
    };

    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        compute();
      });
    };

    const offs = [orig.onScroll(schedule), mod.onScroll(schedule), orig.onResize(schedule), mod.onResize(schedule)];
    const ro = new ResizeObserver(schedule);
    if (boxRef.current) ro.observe(boxRef.current);
    schedule();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      offs.forEach((off) => off());
      ro.disconnect();
    };
  }, [orig, mod, chunks, centerRef]);

  return (
    <div ref={boxRef} className={styles.squiggle}>
      {geom && (
        <svg width={geom.width} height={geom.height} viewBox={`0 0 ${geom.width} ${geom.height}`}>
          {geom.shapes.map((s, i) => {
            const fill =
              `M ${geom.leftX.toFixed(2)} ${s.origStartY.toFixed(2)} ` +
              sigmoid(geom.leftX, s.origStartY, geom.rightX, s.modStartY) +
              ` L ${geom.rightX.toFixed(2)} ${s.modEndY.toFixed(2)} ` +
              sigmoid(geom.rightX, s.modEndY, geom.leftX, s.origEndY) +
              ' Z';

            const top =
              `M 0 ${s.origStartY.toFixed(2)} H ${geom.leftX.toFixed(2)} ` +
              sigmoid(geom.leftX, s.origStartY, geom.rightX, s.modStartY) +
              ` H ${geom.width.toFixed(2)}`;

            const bottom =
              `M 0 ${s.origEndY.toFixed(2)} H ${geom.leftX.toFixed(2)} ` +
              sigmoid(geom.leftX, s.origEndY, geom.rightX, s.modEndY) +
              ` H ${geom.width.toFixed(2)}`;

            return (
              <g key={`c${i}`}>
                <path d={fill} fill={FILL[s.kind]} stroke="none" />
                <path d={top} fill="none" stroke={STROKE[s.kind]} strokeWidth={0.4} vectorEffect="non-scaling-stroke" />
                <path d={bottom} fill="none" stroke={STROKE[s.kind]} strokeWidth={0.4} vectorEffect="non-scaling-stroke" />
              </g>
            );
          })}
          {geom.skips.map((s, i) => {
            const flat = Math.abs(s.origY - s.modY) < 1;
            const d = flat
              ? `M 0 ${s.origY.toFixed(2)} ${wavy(0, s.origY, geom.width)}`
              : `M 0 ${s.origY.toFixed(2)} ${wavy(0, s.origY, geom.leftX)} ` +
                sigmoid(geom.leftX, s.origY, geom.rightX, s.modY) +
                ` ${wavy(geom.rightX, s.modY, geom.width)}`;

            return (
              <path key={`s${i}`} d={d} fill="none" stroke={SKIP_STROKE} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
            );
          })}
        </svg>
      )}
    </div>
  );
};

export default Squiggle;
