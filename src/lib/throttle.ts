/**
 * Leading + trailing throttle: fires immediately on first call, then at most
 * once per `ms`, always delivering the last call as a trailing fire.
 *
 * Used to rate-limit Comlink async calls (physicsProxy.setParam) when a slider
 * fires at ~60 Hz. Without throttle, each drag event creates a Promise that
 * queues behind all previous ones, causing unbounded queue growth.
 */
export function throttle<T extends unknown[]>(
  fn: (...args: T) => void,
  ms: number,
): (...args: T) => void {
  let lastCall = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: T): void => {
    const now = performance.now();
    const remaining = ms - (now - lastCall);
    if (remaining <= 0) {
      clearTimeout(timer);
      timer = undefined;
      lastCall = now;
      fn(...args);
    } else {
      clearTimeout(timer);
      timer = setTimeout(() => {
        lastCall = performance.now();
        timer = undefined;
        fn(...args);
      }, remaining);
    }
  };
}
