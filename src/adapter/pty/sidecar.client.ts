const SIDECAR_HTTP = 'http://127.0.0.1:9777';

export const killPtySession = (tileId: string): Promise<unknown> =>
  fetch(`${SIDECAR_HTTP}/kill?tileId=${encodeURIComponent(tileId)}`).catch(() => undefined);
