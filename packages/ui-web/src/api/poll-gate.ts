export type PollGateState = { paused?: boolean; hidden?: boolean };

export function createPollGate(run: () => unknown) {
  let inFlight = false;
  let paused = false;
  let hidden = false;

  return {
    setState(next: PollGateState) {
      if (next.paused !== undefined) paused = next.paused;
      if (next.hidden !== undefined) hidden = next.hidden;
    },
    tick(): boolean {
      if (paused || hidden || inFlight) return false;
      inFlight = true;
      try {
        void Promise.resolve(run())
          .catch(() => {})
          .finally(() => {
            inFlight = false;
          });
      } catch {
        inFlight = false;
      }
      return true;
    },
  };
}
