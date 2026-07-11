import type { Highlighter, ThemedToken, BundledLanguage } from 'shiki';

const THEME = 'panorama';

let boot: Promise<Highlighter> | null = null;
let langs: Record<string, unknown> = {};

const start = async (): Promise<Highlighter> => {
  const { createHighlighter, bundledLanguages, createCssVariablesTheme } = await import('shiki');
  langs = bundledLanguages;
  const theme = createCssVariablesTheme({ name: THEME, variablePrefix: '--shiki-', fontStyle: true });
  return createHighlighter({ themes: [theme], langs: [] });
};

export const highlight = async (code: string, lang: string): Promise<ThemedToken[][]> => {
  const hl = await (boot ??= start());
  if (!(lang in langs)) return hl.codeToTokens(code, { lang: 'plaintext', theme: THEME }).tokens;

  const id = lang as BundledLanguage;
  if (!hl.getLoadedLanguages().includes(id)) await hl.loadLanguage(id);

  return hl.codeToTokens(code, { lang: id, theme: THEME }).tokens;
};
