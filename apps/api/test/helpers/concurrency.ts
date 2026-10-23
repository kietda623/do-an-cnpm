export class Barrier {
  private remaining: number;
  private readonly waiters: Array<() => void> = [];
  private released = false;

  constructor(participants: number) {
    if (!Number.isInteger(participants) || participants < 1) {
      throw new RangeError("Barrier participants must be a positive integer.");
    }
    this.remaining = participants;
  }

  wait(): Promise<void> {
    if (this.released) {
      return Promise.resolve();
    }

    this.remaining -= 1;
    if (this.remaining === 0) {
      this.released = true;
      for (const release of this.waiters) release();
      return Promise.resolve();
    }

    return new Promise((resolve) => this.waiters.push(resolve));
  }
}

export class FaultInjector {
  private readonly faults = new Map<string, Error>();

  arm(point: string, error = new Error(`Injected failure at ${point}`)): void {
    if (!point.trim()) throw new Error("Fault point must not be empty.");
    this.faults.set(point, error);
  }

  hit(point: string): void {
    const error = this.faults.get(point);
    if (!error) return;
    this.faults.delete(point);
    throw error;
  }

  clear(): void {
    this.faults.clear();
  }
}

export class TestClock {
  private current: number;

  constructor(initialTime: Date | number = Date.now()) {
    this.current = initialTime instanceof Date ? initialTime.getTime() : initialTime;
    if (!Number.isFinite(this.current))
      throw new RangeError("Test clock requires a valid timestamp.");
  }

  now(): Date {
    return new Date(this.current);
  }

  advanceBy(milliseconds: number): Date {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) {
      throw new RangeError("Test clock can only advance by a finite, non-negative duration.");
    }
    this.current += milliseconds;
    return this.now();
  }

  set(time: Date | number): Date {
    const next = time instanceof Date ? time.getTime() : time;
    if (!Number.isFinite(next) || next < this.current) {
      throw new RangeError(
        "Test clock can only be set to a valid time at or after its current time.",
      );
    }
    this.current = next;
    return this.now();
  }
}
