import React from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { X, Copy, Minus, Square, Settings as SettingsIcon, Maximize2, Minimize2 } from 'lucide-react';

import TabsBar from '~/components/commons/TabsBar';
import Settings from '~/components/commons/Settings';
import WorkspaceBar from '~/components/commons/WorkspaceBar';
import UpdateIndicator from '~/components/commons/UpdateIndicator';

import styles from './styles.module.scss';

const win = getCurrentWindow();

const Titlebar = () => {
  const [maximized, setMaximized] = React.useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  React.useEffect(() => {
    let unlisten: (() => void) | undefined;
    const sync = async () => {
      setMaximized(await win.isMaximized());
      setIsFullscreen(await win.isFullscreen());
    };
    void sync();
    void win.onResized(sync).then((fn) => (unlisten = fn));
    return () => unlisten?.();
  }, []);

  const minimize = () => void win.minimize();
  const toggleMaximize = () => void win.toggleMaximize();
  const toggleFullscreen = async () => {
    const isFS = await win.isFullscreen();
    await win.setFullscreen(!isFS);
    setIsFullscreen(!isFS);
  };
  const handleMaximizeClick = async () => {
    if (isFullscreen) {
      await win.setFullscreen(false);
      setIsFullscreen(false);
    } else {
      toggleMaximize();
    }
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        void toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const close = () => void win.close();
  const openSettings = () => setSettingsOpen(true);
  const closeSettings = () => setSettingsOpen(false);

  const onDragStart = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, [data-no-drag]')) return;
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
    <>
      <div className={styles.bar} onMouseDown={onDragStart}>
        <button className={styles.settings} onClick={openSettings} aria-label="Settings">
          <SettingsIcon size={15} strokeWidth={1.75} />
        </button>
        <button className={styles.settings} onClick={toggleFullscreen} aria-label="Toggle Fullscreen">
          {isFullscreen ? <Minimize2 size={15} strokeWidth={1.75} /> : <Maximize2 size={15} strokeWidth={1.75} />}
        </button>
        <WorkspaceBar />
        <TabsBar />
        <div className={styles.controls}>
          <UpdateIndicator />
          <button className={styles.btn} onClick={minimize} aria-label="Minimize">
            <Minus size={16} strokeWidth={1.5} />
          </button>
          <button className={styles.btn} onClick={handleMaximizeClick} aria-label={maximized ? 'Restore' : 'Maximize'}>
            {maximized || isFullscreen ? <Copy size={13} strokeWidth={1.5} /> : <Square size={12} strokeWidth={1.5} />}
          </button>
          <button className={`${styles.btn} ${styles.close}`} onClick={close} aria-label="Close">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>
      {settingsOpen && <Settings onClose={closeSettings} />}
    </>
  );
};

export default Titlebar;
