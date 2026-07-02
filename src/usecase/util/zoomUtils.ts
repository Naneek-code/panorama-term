import { FONT_STEP, ZOOM_MAX, ZOOM_MIN } from '~/usecase/util/constants';

export const clampZoom = (k: number): number => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, k));

export const restTarget = (k: number): number => {
  if (k > ZOOM_MAX) return ZOOM_MAX;
  if (k < ZOOM_MIN) return ZOOM_MIN;
  if (k > 1) return Math.max(1, Math.round(k * FONT_STEP) / FONT_STEP);
  return k;
};
