import { describe, expect, it } from "@jest/globals";
import { Barrier, FaultInjector, TestClock } from "./concurrency.js";

describe("concurrency and time helpers", () => {
  it("releases a barrier only after every participant arrives", async () => {
    const barrier = new Barrier(2);
    let released = false;
    const first = barrier.wait().then(() => {
      released = true;
    });

    await Promise.resolve();
    expect(released).toBe(false);

    await barrier.wait();
    await first;
    expect(released).toBe(true);
  });

  it("injects an armed fault once at the selected point", () => {
    const faults = new FaultInjector();
    const failure = new Error("rollback boundary");
    faults.arm("before-commit", failure);

    expect(() => faults.hit("before-commit")).toThrow(failure);
    expect(() => faults.hit("before-commit")).not.toThrow();
  });

  it("advances deterministically and rejects backward time", () => {
    const clock = new TestClock(new Date("2026-01-01T00:00:00.000Z"));

    expect(clock.advanceBy(1_500).toISOString()).toBe("2026-01-01T00:00:01.500Z");
    expect(() => clock.advanceBy(-1)).toThrow(RangeError);
    expect(() => clock.set(new Date("2025-12-31T23:59:59.000Z"))).toThrow(RangeError);
  });
});
