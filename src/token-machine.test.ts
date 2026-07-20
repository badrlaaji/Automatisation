import { describe, expect, it } from "vitest";
import { assign, createActor, setup } from "xstate";
import type { Graph } from "./graph";
import { tokenMachine } from "./token-machine";

const graph: Graph = {
  start: { id: "start", type: "startEvent", next: "review" },
  review: { id: "review", type: "task", next: "end" },
  end: { id: "end", type: "endEvent" },
};

describe("tokenMachine", () => {
  it("walks past the startEvent and blocks at the first task", () => {
    const actor = createActor(tokenMachine, {
      input: { graph, nodeId: "start", tokenId: "t1" },
    });
    actor.start();

    const snapshot = actor.getSnapshot();
    expect(snapshot.value).toBe("waiting");
    expect(snapshot.context.nodeId).toBe("review");
  });

  it("moves to done and notifies its parent when the task completes", () => {
    const harness = setup({
      types: { context: {} as { done: boolean } },
      actors: { tokenLogic: tokenMachine },
    }).createMachine({
      context: { done: false },
      invoke: {
        id: "t1",
        src: "tokenLogic",
        input: { graph, nodeId: "start", tokenId: "t1" },
      },
      on: {
        TOKEN_DONE: { actions: assign({ done: true }) },
      },
    });

    const actor = createActor(harness);
    actor.start();

    const child = actor.getSnapshot().children.t1;
    child?.send({ type: "COMPLETE_TASK" });

    expect(actor.getSnapshot().context.done).toBe(true);
  });

  it("errors out for an unknown node id", () => {
    const actor = createActor(tokenMachine, {
      input: { graph, nodeId: "missing", tokenId: "t1" },
    });

    let capturedError: unknown;
    actor.subscribe({ error: (err) => (capturedError = err) });
    actor.start();

    expect(String(capturedError)).toMatch(/Unknown node/);
  });
});
