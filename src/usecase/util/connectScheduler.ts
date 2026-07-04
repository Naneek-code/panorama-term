type Job = { fn: () => void; priority: number };

const queue: Job[] = [];
const RATE_MS = 20;
let pumping = false;

const pump = (): void => {
  if (pumping) return;
  pumping = true;
  const step = () => {
    queue.sort((a, b) => b.priority - a.priority);
    const job = queue.shift();
    if (job) job.fn();
    if (queue.length > 0) setTimeout(step, RATE_MS);
    else pumping = false;
  };
  step();
};

export const scheduleConnect = (fn: () => void, priority: number): void => {
  queue.push({ fn, priority });
  pump();
};
