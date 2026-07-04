import React from 'react';
import { X, SquareTerminal } from 'lucide-react';

import { getSetting, setSetting } from '~/adapter/settings/settings.client';
import { ZOOM_MAX, MAX_ZOOM_KEY } from '~/usecase/util/constants';
import { listTerminalTargets, TERMINAL_TARGET_KEY } from '~/usecase/util/terminalTarget';

import styles from './styles.module.scss';

interface SettingsProps {
  onClose: () => void;
}

interface RadioOptionProps {
  label: string;
  selected: boolean;
  description: string;
  onSelect: () => void;
}

const RadioOption = ({ label, description, selected, onSelect }: RadioOptionProps) => (
  <button
    type="button"
    onClick={onSelect}
    className={`${styles.option} ${selected ? styles.selected : ''}`}
  >
    <span className={styles.radio}>{selected && <span className={styles.dot} />}</span>
    <span className={styles.optionText}>
      <span className={styles.optionLabel}>{label}</span>
      <span className={styles.optionDesc}>{description}</span>
    </span>
  </button>
);

const Settings = ({ onClose }: SettingsProps) => {
  const options = React.useMemo(listTerminalTargets, []);
  const [target, setTarget] = React.useState(() => getSetting(TERMINAL_TARGET_KEY, 'auto'));
  const [maxZoom, setMaxZoom] = React.useState(() => getSetting(MAX_ZOOM_KEY, 1));

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const selectTarget = (id: string) => {
    setTarget(id);
    void setSetting(TERMINAL_TARGET_KEY, id);
  };

  const changeMaxZoom = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setMaxZoom(value);
    void setSetting(MAX_ZOOM_KEY, value);
  };

  return (
    <div className={styles.backdrop} onMouseDown={onClose}>
      <div className={styles.panel} onMouseDown={(e) => e.stopPropagation()}>
        <aside className={styles.sidebar}>
          <h1 className={styles.heading}>Settings</h1>
          <nav className={styles.nav}>
            <button type="button" className={`${styles.navItem} ${styles.navActive}`}>
              <SquareTerminal size={15} strokeWidth={1.75} />
              <span>Terminal</span>
            </button>
          </nav>
        </aside>
        <section className={styles.content}>
          <button className={styles.close} onClick={onClose} aria-label="Close settings">
            <X size={15} strokeWidth={1.75} />
          </button>
          <div className={styles.pane}>
            <div className={styles.paneHead}>
              <h2 className={styles.title}>Terminal</h2>
              <p className={styles.subtitle}>Changes take effect for new terminals.</p>
            </div>
            <div className={styles.group}>
              <p className={styles.groupLabel}>Terminal target</p>
              <div className={styles.options}>
                {options.map(({ id, label, isDefault }) => (
                  <RadioOption
                    key={id}
                    label={label}
                    selected={target === id}
                    description={
                      isDefault ? 'Recommended default for this platform.' : 'Available for new terminals.'
                    }
                    onSelect={() => selectTarget(id)}
                  />
                ))}
              </div>
            </div>
            <div className={styles.group}>
              <div className={styles.sliderHead}>
                <p className={styles.groupLabel}>Maximum zoom</p>
                <span className={styles.sliderValue}>{Math.round(maxZoom * 100)}%</span>
              </div>
              <input
                min={1}
                step={0.05}
                type="range"
                max={ZOOM_MAX}
                value={maxZoom}
                onChange={changeMaxZoom}
                className={styles.slider}
              />
              <p className={styles.hint}>Above 100% terminal text may look blurry.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Settings;
