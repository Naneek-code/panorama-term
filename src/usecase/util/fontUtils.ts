const HACK_FACES = [
  ['hacknerdmono-regular.ttf', '400', 'normal'],
  ['hacknerdmono-bold.ttf', '700', 'normal'],
  ['hacknerdmono-italic.ttf', '400', 'italic'],
  ['hacknerdmono-bolditalic.ttf', '700', 'italic']
] as const;

let fontPromise: Promise<unknown> | null = null;

export const loadHackFont = (): Promise<unknown> => {
  fontPromise ??= Promise.all(
    HACK_FACES.map(([file, weight, style]) =>
      new FontFace('Hack', `url('/fonts/${file}')`, { weight, style }).load().then((f) => document.fonts.add(f))
    )
  ).catch(() => undefined);
  return fontPromise;
};
