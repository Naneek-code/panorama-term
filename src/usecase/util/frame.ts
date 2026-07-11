import type { Tile, Frame } from '~/domain/interfaces/canvas.interface';

export const tileInFrame = (frame: Frame, tile: Tile): boolean => {
  const cx = tile.x + tile.width / 2;
  const cy = tile.y + tile.height / 2;
  return cx >= frame.x && cx <= frame.x + frame.width && cy >= frame.y && cy <= frame.y + frame.height;
};

export const groupByFrame = (frames: Frame[], tiles: Tile[]): { members: Map<string, Tile[]>; loose: Tile[] } => {
  const members = new Map<string, Tile[]>(frames.map((f) => [f.id, [] as Tile[]]));
  const loose: Tile[] = [];

  for (const tile of tiles) {
    const frame = frames.find((f) => tileInFrame(f, tile));
    if (frame) members.get(frame.id)?.push(tile);
    else loose.push(tile);
  }

  return { members, loose };
};
