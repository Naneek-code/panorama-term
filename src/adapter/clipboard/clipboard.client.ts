export const writeClipboard = (text: string): void => {
  navigator.clipboard?.writeText(text).catch(() => {});
};

export const readClipboard = (): Promise<string> => {
  if (!navigator.clipboard?.readText) return Promise.resolve('');
  return navigator.clipboard.readText().catch(() => '');
};

export const hasClipboardImage = async (): Promise<boolean> => {
  if (!navigator.clipboard?.read) return false;
  try {
    const items = await navigator.clipboard.read();
    return items.some((item) => item.types.some((t) => t.startsWith('image/')));
  } catch {
    return false;
  }
};
