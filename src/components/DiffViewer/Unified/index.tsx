import type { ThemedToken } from 'shiki';
import type { DiffChunk, UnifiedRow, UnifiedVisual } from '~/domain/interfaces/diff.interface';

import React from 'react';

import { highlight } from '~/usecase/service/highlight';
import { LINE_HEIGHT, SKIP_HEIGHT, collapseUnified, buildUnifiedRows, COLLAPSE_CONTEXT } from '~/usecase/util/diff';

import styles from './styles.module.scss';

interface UnifiedProps {
  old: string;
  next: string;
  lang: string;
  chunks: DiffChunk[];
  collapse: boolean;
}

const Unified = ({ old, next, lang, chunks, collapse }: UnifiedProps) => {
  const [oldTokens, setOldTokens] = React.useState<ThemedToken[][] | null>(null);
  const [newTokens, setNewTokens] = React.useState<ThemedToken[][] | null>(null);
  const [expanded, setExpanded] = React.useState<ReadonlySet<number>>(new Set());

  const oldLines = React.useMemo(() => old.split('\n'), [old]);
  const newLines = React.useMemo(() => next.split('\n'), [next]);
  const rows = React.useMemo(() => buildUnifiedRows(old, next, chunks), [old, next, chunks]);

  React.useEffect(() => {
    setExpanded(new Set());
  }, [rows, collapse]);

  const visuals = React.useMemo(() => {
    if (!collapse) return rows.map((row) => ({ kind: 'row', row }) as UnifiedVisual);
    const base = collapseUnified(rows, COLLAPSE_CONTEXT);
    if (expanded.size === 0) return base;
    return base.flatMap((v) =>
      v.kind === 'skip' && expanded.has(v.index) ? v.rows.map((row) => ({ kind: 'row', row }) as UnifiedVisual) : [v]
    );
  }, [rows, collapse, expanded]);

  React.useEffect(() => {
    let alive = true;
    highlight(old, lang).then((lines) => alive && setOldTokens(lines));
    highlight(next, lang).then((lines) => alive && setNewTokens(lines));
    return () => {
      alive = false;
    };
  }, [old, next, lang]);

  const expand = (index: number) => () => setExpanded((prev) => new Set(prev).add(index));

  const renderRow = (row: UnifiedRow, key: string) => {
    const oldNo = row.kind === 'added' ? null : row.oldLine;
    const newNo = row.kind === 'deleted' ? null : row.newLine;
    const tokens = row.kind === 'deleted' ? oldTokens?.[row.oldLine - 1] : newTokens?.[(newNo ?? 1) - 1];
    const raw = row.kind === 'deleted' ? oldLines[row.oldLine - 1] : newLines[(newNo ?? 1) - 1];

    return (
      <div
        key={key}
        className={styles.row}
        data-kind={row.kind}
        style={{ height: LINE_HEIGHT, lineHeight: `${LINE_HEIGHT}px` }}
      >
        <span className={styles.no}>{oldNo}</span>
        <span className={`${styles.no} ${styles.newNo}`}>{newNo}</span>
        <pre className={styles.code} style={{ height: LINE_HEIGHT, lineHeight: `${LINE_HEIGHT}px` }}>
          {tokens
            ? tokens.map((token, j) => (
                <span key={j} style={{ color: token.color, fontStyle: token.fontStyle === 1 ? 'italic' : undefined }}>
                  {token.content}
                </span>
              ))
            : (raw ?? '')}
        </pre>
      </div>
    );
  };

  return (
    <div className={styles.unified}>
      {visuals.map((v, i) =>
        v.kind === 'skip' ? (
          <button
            key={`s${i}`}
            className={styles.skip}
            style={{ height: SKIP_HEIGHT }}
            onClick={expand(v.index)}
            data-tooltip={`Show ${v.rows.length} hidden lines`}
            aria-label={`Show ${v.rows.length} hidden lines`}
          />
        ) : (
          renderRow(v.row, `r${i}`)
        )
      )}
    </div>
  );
};

export default Unified;
