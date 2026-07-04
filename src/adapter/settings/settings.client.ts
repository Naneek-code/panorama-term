import { storeRead, storeWrite } from '~/adapter/store/store.client';

export type Settings = Record<string, unknown>;

const FILE = 'config.json';

let cache: Settings = {};

export const initSettings = async (): Promise<Settings> => {
  cache = (await storeRead<Settings>(FILE)) ?? {};
  return cache;
};

export const getSetting = <T>(key: string, fallback: T): T =>
  (cache[key] as T | undefined) ?? fallback;

export const setSetting = async (key: string, value: unknown): Promise<void> => {
  cache = { ...cache, [key]: value };
  await storeWrite(FILE, cache);
};

export const loadSettings = async (): Promise<Settings> => (await storeRead<Settings>(FILE)) ?? {};

export const saveSettings = (settings: Settings): Promise<void> => storeWrite(FILE, settings);
