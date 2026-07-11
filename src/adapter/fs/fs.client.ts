import { invoke } from '@tauri-apps/api/core';

export interface DirEntry {
  name: string;
  path: string;
  dir: boolean;
}

export const readDir = (path: string): Promise<DirEntry[]> =>
  invoke<DirEntry[]>('read_dir', { path }).catch(() => [] as DirEntry[]);
