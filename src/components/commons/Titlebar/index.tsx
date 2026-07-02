import React from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

import styles from './styles.module.scss';

const win = getCurrentWindow();

const Titlebar = () => {
  const [maximized, setMaximized] = React.useState(false);

  React.useEffect(() => {
    let unlisten: (() => void) | undefined;
    const sync = async () => setMaximized(await win.isMaximized());
    void sync();
    void win.onResized(sync).then((fn) => (unlisten = fn));
    return () => unlisten?.();
  }, []);

  const minimize = () => void win.minimize();
  const toggleMaximize = () => void win.toggleMaximize();
  const close = () => void win.close();

  const onDragStart = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button')) return;
    if (e.detail === 2) {
      void win.toggleMaximize();
      return;
    }

    const cleanup = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', cleanup);
    };
    const onMove = () => {
      cleanup();
      void win.startDragging();
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', cleanup);
  };

  return (
    <div className={styles.bar} onMouseDown={onDragStart}>
      <span className={styles.brand}>Panorama</span>
      <div className={styles.controls}>
        <button className={styles.btn} onClick={minimize} aria-label="Minimize">
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M0 5 H10" stroke="currentColor" strokeWidth="1" fill="none" />
          </svg>
        </button>
        <button className={styles.btn} onClick={toggleMaximize} aria-label={maximized ? 'Restore' : 'Maximize'}>
          {maximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <path d="M2.5 2.5 V0.5 H9.5 V7.5 H7.5" stroke="currentColor" strokeWidth="1" fill="none" />
              <rect x="0.5" y="2.5" width="7" height="7" stroke="currentColor" strokeWidth="1" fill="none" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" strokeWidth="1" fill="none" />
            </svg>
          )}
        </button>
        <button className={`${styles.btn} ${styles.close}`} onClick={close} aria-label="Close">
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M0.5 0.5 L9.5 9.5 M9.5 0.5 L0.5 9.5" stroke="currentColor" strokeWidth="1" fill="none" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Titlebar;
