export class SessionRestore {
  private inFlight: Promise<unknown> | undefined;

  run<T>(restore: () => Promise<T>): Promise<T> {
    if (!this.inFlight) {
      this.inFlight = restore().finally(() => {
        this.inFlight = undefined;
      });
    }
    return this.inFlight as Promise<T>;
  }
}
