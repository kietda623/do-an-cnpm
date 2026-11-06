import assert from "node:assert/strict";
import { test } from "node:test";
import { createPollGate } from "../src/api/poll-gate.ts";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function flushMicrotasks() {
  await new Promise((done) => setTimeout(done, 0));
}

test("runs at most one refresh at a time and unlocks when it settles", async () => {
  const pending = deferred();
  let calls = 0;
  const gate = createPollGate(() => {
    calls += 1;
    return pending.promise;
  });

  assert.equal(gate.tick(), true);
  assert.equal(gate.tick(), false);
  assert.equal(calls, 1);

  pending.resolve();
  await flushMicrotasks();

  assert.equal(gate.tick(), true);
  assert.equal(calls, 2);
});

test("skips ticks while hidden or paused", () => {
  let calls = 0;
  const gate = createPollGate(() => {
    calls += 1;
  });

  gate.setState({ hidden: true });
  assert.equal(gate.tick(), false);

  gate.setState({ hidden: false, paused: true });
  assert.equal(gate.tick(), false);

  gate.setState({ paused: false });
  assert.equal(gate.tick(), true);
  assert.equal(calls, 1);
});

test("swallows rejected refreshes and resets the in-flight lock", async () => {
  let calls = 0;
  const gate = createPollGate(() => {
    calls += 1;
    return Promise.reject(new Error("network down"));
  });

  assert.equal(gate.tick(), true);
  await flushMicrotasks();

  assert.equal(gate.tick(), true);
  assert.equal(calls, 2);
});

test("turns synchronous throws into a swallowed failure", async () => {
  let calls = 0;
  const gate = createPollGate(() => {
    calls += 1;
    throw new Error("boom");
  });

  assert.equal(gate.tick(), true);
  await flushMicrotasks();

  assert.equal(gate.tick(), true);
  assert.equal(calls, 2);
});
