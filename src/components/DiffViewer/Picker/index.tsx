import React from 'react';
import { ChevronDown } from 'lucide-react';

import styles from './styles.module.scss';

interface PickerProps<T extends string> {
  value: T;
  options: T[];
  labels: Record<T, string>;
  disabled?: boolean;
  onChange: (value: T) => void;
}

const Picker = <T extends string>({ value, options, labels, disabled, onChange }: PickerProps<T>) => {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;

    const outside = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
    };

    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const toggle = () => setOpen((v) => !v);
  const pick = (option: T) => () => {
    onChange(option);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={styles.root} data-picker-open={open ? '' : undefined}>
      <button className={styles.button} onClick={toggle} disabled={disabled}>
        {labels[value]}
        <ChevronDown size={12} strokeWidth={2} />
      </button>
      {open && (
        <div className={styles.menu}>
          {options.map((option) => (
            <button key={option} className={styles.item} data-active={option === value} onClick={pick(option)}>
              {labels[option]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Picker;
