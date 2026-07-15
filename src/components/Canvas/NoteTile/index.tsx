import React from 'react';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { history, defaultKeymap, historyKeymap, indentWithTab } from '@codemirror/commands';

import type { Tile } from '~/domain/interfaces/canvas.interface';
import { noteTheme } from '~/usecase/util/note';
import { livePreview, markdownBase } from '~/usecase/util/markdownLivePreview';

import styles from './styles.module.scss';

interface NoteTileProps {
  tile: Tile;
  active: boolean;
  onChange: (id: string, content: string) => void;
  onActivate: (id: string) => void;
  onEditor: (id: string, editor: EditorView | null) => void;
}

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '13px', color: 'var(--note-text)', background: 'transparent' },
  '.cm-content': { padding: '8px 10px', lineHeight: '1.5', caretColor: 'var(--note-text)' },
  '.cm-scroller': { fontFamily: 'inherit', lineHeight: '1.5' },
  '&.cm-focused': { outline: 'none' },
  '.cm-cursor': { borderLeftColor: 'var(--note-text)' },
  '.cm-placeholder': { color: 'var(--note-text)', opacity: '0.5' },
  '.cm-scroller::-webkit-scrollbar': { width: '8px' },
  '.cm-scroller::-webkit-scrollbar-track': { background: 'transparent' },
  '.cm-scroller::-webkit-scrollbar-thumb': {
    borderRadius: '4px',
    background: 'color-mix(in srgb, var(--note-text) 30%, transparent)'
  },
  '.cm-scroller::-webkit-scrollbar-thumb:hover': { background: 'color-mix(in srgb, var(--note-text) 50%, transparent)' },
  '.cm-scroller::-webkit-scrollbar-button': { display: 'none' }
});

const NoteTile = ({ tile, active, onChange, onActivate, onEditor }: NoteTileProps) => {
  const host = React.useRef<HTMLDivElement | null>(null);
  const view = React.useRef<EditorView | null>(null);
  const preview = React.useRef(new Compartment());
  const save = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const emit = React.useRef(onChange);
  emit.current = onChange;

  React.useEffect(() => {
    if (!host.current) return;

    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: tile.content || '',
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          markdownBase(),
          preview.current.of(livePreview(tile.renderOnly ? 'render' : 'edit')),
          EditorView.lineWrapping,
          placeholder('Click to edit...'),
          theme,
          EditorView.updateListener.of((u) => {
            if (!u.docChanged) return;
            if (save.current) clearTimeout(save.current);
            const text = u.state.doc.toString();
            save.current = setTimeout(() => emit.current(tile.id, text), 300);
          })
        ]
      })
    });

    view.current = editor;
    onEditor(tile.id, editor);

    return () => {
      if (save.current) clearTimeout(save.current);
      onEditor(tile.id, null);
      editor.destroy();
      view.current = null;
    };
  }, [tile.id, onEditor]);

  React.useEffect(() => {
    view.current?.dispatch({ effects: preview.current.reconfigure(livePreview(tile.renderOnly ? 'render' : 'edit')) });
  }, [tile.renderOnly]);

  const activate = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    onActivate(tile.id);
  };

  const stopWheel = (e: React.WheelEvent) => {
    if (active) e.stopPropagation();
  };

  const tint = noteTheme(tile.color);
  const cls = active ? `${styles.editor} ${styles.scrollable}` : styles.editor;

  return (
    <div
      className={`pano-note ${styles.note}`}
      onWheel={stopWheel}
      onPointerDown={activate}
      style={{
        ['--note-body' as string]: tint.body,
        ['--note-text' as string]: tint.text
      }}
    >
      <div ref={host} className={cls} />
    </div>
  );
};

export default NoteTile;
