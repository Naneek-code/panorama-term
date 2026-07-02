import type { Tile, View } from '~/domain/interfaces/canvas.interface';
import { STORE_KEY } from '~/usecase/util/constants';
import { clampZoom, restTarget } from '~/usecase/util/zoomUtils';

export interface CanvasState {
  view: View;
  tiles: Tile[];
}

export const loadCanvas = (): CanvasState => {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const state = JSON.parse(raw) as CanvasState;
      state.view.k = restTarget(clampZoom(state.view.k));
      return state;
    }
  } catch {}
  return { tiles: [], view: { x: 0, y: 0, k: 1 } };
};

export const saveCanvas = (state: CanvasState): void => {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
};
