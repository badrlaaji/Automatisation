import { describe, expect, it } from "vitest";
import { createActor } from "xstate";
import type { Graph } from "./graph";
import { bpmnEngineMachine } from "./machine";

const simpleGraph: Graph = {
  start: { id: "start", type: "startEvent", next: "approveOrder" },
  approveOrder: { id: "approveOrder", type: "task", next: "end" },
  end: { id: "end", type: "endEvent" },
};

describe("bpmnEngineMachine", () => {
  it("starts idle and moves to waiting on the first task", () => {
    const actor = createActor(bpmnEngineMachine, {
      input: { graph: simpleGraph },
    });
    actor.start();

    expect(actor.getSnapshot().value).toBe("idle");

    actor.send({ type: "START" });

    const snapshot = actor.getSnapshot();
    expect(snapshot.value).toBe("waiting");
    expect(snapshot.context.waitpoints).toHaveLength(1);
    expect(snapshot.context.waitpoints[0]).toMatchObject({
      nodeId: "approveOrder",
      type: "task",
    });
    expect(snapshot.context.tokens).toHaveLength(1);
    expect(snapshot.context.tokens[0].nodeId).toBe("approveOrder");
  });

  it("completes the workflow once the task is completed", () => {
    const actor = createActor(bpmnEngineMachine, {
      input: { graph: simpleGraph },
    });
    actor.start();
    actor.send({ type: "START" });

    const tokenId = actor.getSnapshot().context.waitpoints[0].tokenId;
    actor.send({ type: "COMPLETE_TASK", tokenId });

    const snapshot = actor.getSnapshot();
    expect(snapshot.value).toBe("completed");
    expect(snapshot.context.tokens).toHaveLength(0);
    expect(snapshot.context.waitpoints).toHaveLength(0);
    expect(snapshot.status).toBe("done");
  });

  it("ignores COMPLETE_TASK for an unknown tokenId", () => {
    const actor = createActor(bpmnEngineMachine, {
      input: { graph: simpleGraph },
    });
    actor.start();
    actor.send({ type: "START" });

    actor.send({ type: "COMPLETE_TASK", tokenId: "not-a-real-token" });

    const snapshot = actor.getSnapshot();
    expect(snapshot.value).toBe("waiting");
    expect(snapshot.context.waitpoints).toHaveLength(1);
  });

  it("supports sequential multi-task graphs", () => {
    const graph: Graph = {
      start: { id: "start", type: "startEvent", next: "taskA" },
      taskA: { id: "taskA", type: "task", next: "taskB" },
      taskB: { id: "taskB", type: "task", next: "end" },
      end: { id: "end", type: "endEvent" },
    };

    const actor = createActor(bpmnEngineMachine, { input: { graph } });
    actor.start();
    actor.send({ type: "START" });

    expect(actor.getSnapshot().context.waitpoints[0].nodeId).toBe("taskA");

    const firstTokenId = actor.getSnapshot().context.waitpoints[0].tokenId;
    actor.send({ type: "COMPLETE_TASK", tokenId: firstTokenId });

    expect(actor.getSnapshot().value).toBe("waiting");
    expect(actor.getSnapshot().context.waitpoints[0].nodeId).toBe("taskB");

    const secondTokenId = actor.getSnapshot().context.waitpoints[0].tokenId;
    actor.send({ type: "COMPLETE_TASK", tokenId: secondTokenId });

    expect(actor.getSnapshot().value).toBe("completed");
  });
});
