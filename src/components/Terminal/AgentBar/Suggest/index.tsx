import React from 'react';
import { Bot, Brain, SquareTerminal } from 'lucide-react';

import type { PromptSuggestion, AgentSuggestHandle } from '../types';

import styles from './styles.module.scss';

interface SuggestProps {
  query: string;
  onClose: () => void;
  fetchFn: (query: string) => PromptSuggestion[];
  onSelect: (item: PromptSuggestion, submit?: boolean) => void;
  onHighlight?: (item: PromptSuggestion) => void;
}

const Suggest = React.forwardRef<AgentSuggestHandle, SuggestProps>(
  ({ query, fetchFn, onSelect, onHighlight, onClose }, ref) => {
    const listRef = React.useRef<HTMLDivElement>(null);
    const [selected, setSelected] = React.useState(0);

    const items = React.useMemo(() => fetchFn(query), [fetchFn, query]);

    React.useEffect(() => {
      setSelected(0);
    }, [query]);

    React.useEffect(() => {
      const child = listRef.current?.children[selected];
      if (child) (child as HTMLElement).scrollIntoView({ block: 'nearest' });
    }, [selected]);

    React.useEffect(() => {
      const onDown = (e: MouseEvent) => {
        if (listRef.current && !listRef.current.contains(e.target as Node)) onClose();
      };
      document.addEventListener('mousedown', onDown);
      return () => document.removeEventListener('mousedown', onDown);
    }, [onClose]);

    React.useImperativeHandle(
      ref,
      () => ({
        handleKeyDown(e: React.KeyboardEvent): boolean {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            e.stopPropagation();
            if (items.length === 0) return true;
            const next = Math.min(selected + 1, items.length - 1);
            setSelected(next);
            const item = items[next];
            if (item) onHighlight?.(item);
            return true;
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            e.stopPropagation();
            if (items.length === 0) return true;
            const next = Math.max(selected - 1, 0);
            setSelected(next);
            const item = items[next];
            if (item) onHighlight?.(item);
            return true;
          }
          if (e.key === 'Enter' || e.key === 'Tab') {
            if (items.length === 0) return false;
            e.preventDefault();
            e.stopPropagation();
            const item = items[selected];
            if (item) onSelect(item, e.key === 'Enter');
            return true;
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onClose();
            return true;
          }
          return false;
        }
      }),
      [items, selected, onSelect, onHighlight, onClose]
    );

    const pick = (item: PromptSuggestion) => (e: React.MouseEvent) => {
      e.preventDefault();
      onSelect(item);
      onClose();
    };

    return (
      <div ref={listRef} className={styles.suggest}>
        {items.length === 0 ? (
          <div className={styles.empty}>No results</div>
        ) : (
          items.map((item, i) => (
            <div
              key={item.id}
              onMouseDown={pick(item)}
              className={i === selected ? `${styles.item} ${styles.selected}` : styles.item}
            >
              {item.icon === 'model' && <Bot size={13} className={styles.icon} />}
              {item.icon === 'effort' && <Brain size={13} className={styles.icon} style={{ color: item.color }} />}
              {item.icon === 'cmd' && <SquareTerminal size={13} className={styles.icon} />}
              <span className={styles.display} style={item.color ? { color: item.color } : undefined}>
                {item.display}
              </span>
              {item.subtext && <span className={styles.sub}>{item.subtext}</span>}
            </div>
          ))
        )}
      </div>
    );
  }
);

Suggest.displayName = 'Suggest';

export default Suggest;
