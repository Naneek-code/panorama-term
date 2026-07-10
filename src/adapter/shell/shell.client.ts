import { invoke } from '@tauri-apps/api/core';

export const revealPath = (path: string): void => {
  void invoke('reveal_path', { path }).catch(() => {});
};
