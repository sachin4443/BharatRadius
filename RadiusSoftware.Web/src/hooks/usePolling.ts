import { useEffect, useRef } from "react";

/**
 * Runs `task` now and then every `intervalMs`, but:
 *  - never starts a new call while the previous one is still running
 *    (slow router / server can no longer pile up requests),
 *  - pauses while the browser tab is hidden and refreshes once when it is shown again.
 */
export function usePolling(
  task: () => Promise<unknown> | void,
  intervalMs: number,
  enabled = true,
  deps: unknown[] = [],
) {
  const taskRef = useRef(task);
  taskRef.current = task;

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let running = false;
    let timer: number | undefined;

    const run = async () => {
      if (stopped || running || document.hidden) return;
      running = true;
      try {
        await taskRef.current();
      } catch {
        // errors are handled inside the task
      } finally {
        running = false;
      }
    };

    const schedule = () => {
      timer = window.setTimeout(async () => {
        await run();
        if (!stopped) schedule();
      }, intervalMs);
    };

    const onVisible = () => {
      if (!document.hidden) run();
    };

    run();
    schedule();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, intervalMs, ...deps]);
}
