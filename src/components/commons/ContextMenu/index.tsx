import React from 'react';

import styles from './styles.module.scss';

export interface ContextMenuItem {
  label: string;
  onSelect: () => void;
  icon?: React.ReactNode;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
}

export type ContextMenuEntry = ContextMenuItem | 'separator';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  items: ContextMenuEntry[];
}

const EDGE = 8;

const ContextMenu = ({ x, y, items, onClose }: ContextMenuProps) => {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState({ x, y });

  React.useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const nx = Math.min(x, window.innerWidth - width - EDGE);
    const ny = Math.min(y, window.innerHeight - height - EDGE);
    setPos({ x: Math.max(EDGE, nx), y: Math.max(EDGE, ny) });
  }, [x, y]);

  React.useEffect(() => {
    const onOutside = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', onOutside, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onOutside, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [onClose]);

  const stop = (e: React.PointerEvent) => e.stopPropagation();

  return (
    <div ref={rootRef} className={styles.menu} style={{ top: pos.y, left: pos.x }} onPointerDown={stop}>
      {items.map((item, i) => {
        if (item === 'separator') return <div key={`sep-${i}`} className={styles.separator} />;

        const select = () => {
          if (item.disabled) return;
          item.onSelect();
          onClose();
        };

        const cls = [styles.item, item.danger && styles.danger, item.disabled && styles.disabled]
          .filter(Boolean)
          .join(' ');

        return (
          <button key={item.label} className={cls} onClick={select} disabled={item.disabled}>
            {item.icon && <span className={styles.icon}>{item.icon}</span>}
            <span className={styles.label}>{item.label}</span>
            {item.shortcut && <span className={styles.shortcut}>{item.shortcut}</span>}
          </button>
        );
      })}
    </div>
  );
};

export default ContextMenu;
