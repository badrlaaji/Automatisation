import { describe, it, expect } from "vitest";
import { createActor } from "xstate";
import { executionMachine } from "./XStateWorkflow";

describe("Execution lifecycle machine", () => {
  it("starts in Idle and transitions to Executing on START", () => {
    const actor = createActor(executionMachine);
    actor.start();

    expect(actor.getSnapshot().value).toBe("Idle");

    actor.send({ type: "START" });
    expect(actor.getSnapshot().value).toBe("Executing");
  });

  it("transitions Executing → Waiting on TASK_ENCOUNTERED", () => {
    const actor = createActor(executionMachine);
    actor.start();
    actor.send({ type: "START" });

    actor.send({ type: "TASK_ENCOUNTERED" });

    expect(actor.getSnapshot().value).toBe("Waiting");
  });

  it("transitions Waiting → Executing on TASK_COMPLETED", () => {
    const actor = createActor(executionMachine);
    actor.start();
    actor.send({ type: "START" });
    actor.send({ type: "TASK_ENCOUNTERED" });

    actor.send({ type: "TASK_COMPLETED" });

    expect(actor.getSnapshot().value).toBe("Executing");
  });

  it("transitions Executing → Completed on COMPLETE", () => {
    const actor = createActor(executionMachine);
    actor.start();
    actor.send({ type: "START" });

    actor.send({ type: "COMPLETE" });

    expect(actor.getSnapshot().value).toBe("Completed");
  });

  it("persists and restores state correctly", () => {
    const actor = createActor(executionMachine);
    actor.start();
    actor.send({ type: "START" });
    actor.send({ type: "TASK_ENCOUNTERED" });

    expect(actor.getSnapshot().value).toBe("Waiting");
    const snapshot = actor.getPersistedSnapshot();

    const restored = createActor(executionMachine, { state: snapshot as any });
    restored.start();
    expect(restored.getSnapshot().value).toBe("Waiting");

    restored.send({ type: "TASK_COMPLETED" });
    expect(restored.getSnapshot().value).toBe("Executing");
  });

  it("supports full lifecycle: Idle → Executing → Waiting → Executing → Completed", () => {
    const actor = createActor(executionMachine);
    actor.start();

    actor.send({ type: "START" });
    expect(actor.getSnapshot().value).toBe("Executing");

    actor.send({ type: "TASK_ENCOUNTERED" });
    expect(actor.getSnapshot().value).toBe("Waiting");

    actor.send({ type: "TASK_COMPLETED" });
    expect(actor.getSnapshot().value).toBe("Executing");

    actor.send({ type: "COMPLETE" });
    expect(actor.getSnapshot().value).toBe("Completed");
  });
});
