import { describe, expect, it } from "vitest";
import { createActor } from "xstate";
import type { Graph } from "./graph";
import { bpmnEngineMachine, getTokens, getWaitpoints } from "./machine";

const simpleGraph: Graph = {
  start: { id: "start", type: "startEvent", next: "approveOrder" },
  approveOrder: { id: "approveOrder", type: "task", next: "end" },
  end: { id: "end", type: "endEvent" },
};

describe("bpmnEngineMachine", () => {
  it("starts idle and exposes a waitpoint once the first task blocks it", () => {
    const actor = createActor(bpmnEngineMachine, {
      input: { graph: simpleGraph },
    });
    actor.start();

    expect(actor.getSnapshot().value).toBe("idle");

    actor.send({ type: "START" });

    const snapshot = actor.getSnapshot();
    expect(snapshot.value).toBe("active");

    const waitpoints = getWaitpoints(snapshot);
    expect(waitpoints).toHaveLength(1);
    expect(waitpoints[0]).toMatchObject({
      nodeId: "approveOrder",
      type: "task",
    });

    const tokens = getTokens(snapshot);
    expect(tokens).toHaveLength(1);
    expect(tokens[0].nodeId).toBe("approveOrder");
  });

  it("completes the workflow once its only token finishes", () => {
    const actor = createActor(bpmnEngineMachine, {
      input: { graph: simpleGraph },
    });
    actor.start();
    actor.send({ type: "START" });

    const tokenId = getWaitpoints(actor.getSnapshot())[0].tokenId;
    actor.send({ type: "COMPLETE_TASK", tokenId });

    const snapshot = actor.getSnapshot();
    expect(snapshot.value).toBe("completed");
    expect(snapshot.status).toBe("done");
    expect(getTokens(snapshot)).toHaveLength(0);
    expect(getWaitpoints(snapshot)).toHaveLength(0);
  });

  it("ignores COMPLETE_TASK for an unknown tokenId", () => {
    const actor = createActor(bpmnEngineMachine, {
      input: { graph: simpleGraph },
    });
    actor.start();
    actor.send({ type: "START" });

    actor.send({ type: "COMPLETE_TASK", tokenId: "not-a-real-token" });

    const snapshot = actor.getSnapshot();
    expect(snapshot.value).toBe("active");
    expect(getWaitpoints(snapshot)).toHaveLength(1);
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

    expect(getWaitpoints(actor.getSnapshot())[0].nodeId).toBe("taskA");

    const firstTokenId = getWaitpoints(actor.getSnapshot())[0].tokenId;
    actor.send({ type: "COMPLETE_TASK", tokenId: firstTokenId });

    expect(actor.getSnapshot().value).toBe("active");
    expect(getWaitpoints(actor.getSnapshot())[0].nodeId).toBe("taskB");

    const secondTokenId = getWaitpoints(actor.getSnapshot())[0].tokenId;
    actor.send({ type: "COMPLETE_TASK", tokenId: secondTokenId });

    expect(actor.getSnapshot().value).toBe("completed");
  });

  it("keeps the token id stable across the workflow for a single token", () => {
    const actor = createActor(bpmnEngineMachine, {
      input: { graph: simpleGraph },
    });
    actor.start();
    actor.send({ type: "START" });

    const tokenId = getWaitpoints(actor.getSnapshot())[0].tokenId;
    expect(getTokens(actor.getSnapshot())[0].id).toBe(tokenId);
  });
});
