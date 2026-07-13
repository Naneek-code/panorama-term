import React from 'react';

import type { TrackCounts } from '~/domain/interfaces/git.interface';
import { gitAheadBehind } from '~/adapter/git/git.client';

const POLL_MS = 15000;
const NONE: TrackCounts = { ahead: 0, behind: 0 };

export const useAheadBehind = (cwd: string | undefined, branch: string | undefined): TrackCounts => {
  const [track, setTrack] = React.useState<TrackCounts>(NONE);

  React.useEffect(() => {
    if (!cwd || !branch) {
      setTrack(NONE);
      return;
    }
    let alive = true;
    const refresh = () => {
      gitAheadBehind(cwd)
        .then((t) => alive && setTrack(t))
        .catch(() => alive && setTrack(NONE));
    };
    refresh();
    const timer = window.setInterval(refresh, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [cwd, branch]);

  return track;
};
