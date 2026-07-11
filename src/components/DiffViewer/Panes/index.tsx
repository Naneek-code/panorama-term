import type {
  PaneApi,
  DiffChunk,
  HighlightMode,
  IntraLineHighlights
} from '~/domain/interfaces/diff.interface';

import React from 'react';

import Gutter from '~/components/DiffViewer/Gutter';
import CodePane from '~/components/DiffViewer/CodePane';
import Squiggle from '~/components/DiffViewer/Squiggle';
import { mapByAnchors, expandRows, buildAnchors, buildVisualRows, COLLAPSE_CONTEXT } from '~/usecase/util/diff';

import styles from './styles.module.scss';

interface PanesProps {
  old: string;
  next: string;
  lang: string;
  chunks: DiffChunk[];
  intra: IntraLineHighlights | null;
  mode: HighlightMode;
  collapse: boolean;
  chunkIndex: number;
}

const NO_CHUNKS: DiffChunk[] = [];

const Panes = ({ old, next, lang, chunks, intra, mode, collapse, chunkIndex }: PanesProps) => {
  const painted = mode === 'none' ? NO_CHUNKS : chunks;
  const [origApi, setOrigApi] = React.useState<PaneApi | null>(null);
  const [modApi, setModApi] = React.useState<PaneApi | null>(null);
  const centerRef = React.useRef<HTMLDivElement>(null);

  const takeOrig = React.useCallback((api: PaneApi | null) => api && setOrigApi(api), []);
  const takeMod = React.useCallback((api: PaneApi | null) => api && setModApi(api), []);

  const [expanded, setExpanded] = React.useState<ReadonlySet<number>>(new Set());

  React.useEffect(() => {
    setExpanded(new Set());
  }, [chunks, collapse]);

  const expand = React.useCallback(
    (index: number) => setExpanded((prev) => new Set(prev).add(index)),
    []
  );

  const origRows = React.useMemo(
    () => expandRows(buildVisualRows(chunks, 'orig', old.split('\n').length, COLLAPSE_CONTEXT, collapse), expanded),
    [chunks, old, collapse, expanded]
  );
  const modRows = React.useMemo(
    () => expandRows(buildVisualRows(chunks, 'mod', next.split('\n').length, COLLAPSE_CONTEXT, collapse), expanded),
    [chunks, next, collapse, expanded]
  );

  React.useEffect(() => {
    if (!origApi || !modApi) return;

    let syncing = false;
    const sync = (from: PaneApi, to: PaneApi, side: 'orig' | 'mod') => () => {
      if (syncing) return;
      const y = mapByAnchors(buildAnchors(chunks, from, to, side), from.getScrollTop());
      if (Math.abs(to.getScrollTop() - y) <= 0.5) return;
      syncing = true;
      to.setScrollTop(y);
      syncing = false;
    };

    const off1 = origApi.onScroll(sync(origApi, modApi, 'orig'));
    const off2 = modApi.onScroll(sync(modApi, origApi, 'mod'));

    return () => {
      off1();
      off2();
    };
  }, [chunks, origApi, modApi]);

  React.useEffect(() => {
    if (!origApi || !modApi) return;
    const chunk = chunks[chunkIndex];
    const el = origApi.getElement();
    if (!chunk || !el) return;

    const pane = chunk.kind === 'insert' ? modApi : origApi;
    const line = chunk.kind === 'insert' ? chunk.modStart : chunk.origStart;
    const top = pane.getTopForLine(Math.max(1, line));
    pane.setScrollTop(Math.max(0, top - el.clientHeight * 0.33));
  }, [chunkIndex, chunks, origApi, modApi]);

  return (
    <div className={styles.panes}>
      <div className={styles.pane}>
        <CodePane
          code={old}
          lang={lang}
          side="orig"
          rows={origRows}
          chunks={painted}
          current={chunks[chunkIndex] ?? null}
          ranges={intra?.oldByLine ?? null}
          overrides={intra?.oldKindOverride ?? null}
          onApi={takeOrig}
          onExpand={expand}
        />
        {origApi && <Gutter api={origApi} side="orig" chunks={chunks} />}
      </div>

      <div ref={centerRef} className={styles.center} aria-hidden />

      <div className={styles.pane}>
        {modApi && <Gutter api={modApi} side="mod" chunks={chunks} />}
        <CodePane
          code={next}
          lang={lang}
          side="mod"
          rows={modRows}
          chunks={painted}
          current={chunks[chunkIndex] ?? null}
          ranges={intra?.newByLine ?? null}
          overrides={intra?.newKindOverride ?? null}
          onApi={takeMod}
          onExpand={expand}
        />
      </div>

      {origApi && modApi && <Squiggle orig={origApi} mod={modApi} chunks={chunks} centerRef={centerRef} />}
    </div>
  );
};

export default Panes;
