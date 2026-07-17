import { describe, it, expect } from "vitest";
import { createEngine } from "../test/helpers";
import { WorkflowDefinition } from "../entities/Workflow";

// ---------------------------------------------------------------------------
// BPMN workflow definitions using the Node / SequenceFlow model
// ---------------------------------------------------------------------------

const startToEnd: WorkflowDefinition = {
  nodes: [
    { id: "start", type: "StartEvent", outgoing: [{ id: "s1", source: "start", target: "end" }] },
    { id: "end", type: "EndEvent", outgoing: [] },
  ],
  sequenceFlows: [{ id: "s1", source: "start", target: "end" }],
  steps: {},
};

const startTaskEnd: WorkflowDefinition = {
  nodes: [
    { id: "start", type: "StartEvent", outgoing: [{ id: "s1", source: "start", target: "task1" }] },
    { id: "task1", type: "Task", outgoing: [{ id: "s2", source: "task1", target: "end" }] },
    { id: "end", type: "EndEvent", outgoing: [] },
  ],
  sequenceFlows: [
    { id: "s1", source: "start", target: "task1" },
    { id: "s2", source: "task1", target: "end" },
  ],
  steps: {},
};

const startTaskTaskEnd: WorkflowDefinition = {
  nodes: [
    { id: "start", type: "StartEvent", outgoing: [{ id: "s1", source: "start", target: "task1" }] },
    { id: "task1", type: "Task", outgoing: [{ id: "s2", source: "task1", target: "task2" }] },
    { id: "task2", type: "Task", outgoing: [{ id: "s3", source: "task2", target: "end" }] },
    { id: "end", type: "EndEvent", outgoing: [] },
  ],
  sequenceFlows: [
    { id: "s1", source: "start", target: "task1" },
    { id: "s2", source: "task1", target: "task2" },
    { id: "s3", source: "task2", target: "end" },
  ],
  steps: {},
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BPMN workflow execution", () => {
  describe("Workflow #1: StartEvent → EndEvent", () => {
    it("completes in one call: StartEvent auto-advances, EndEvent completes", async () => {
      const { engine, processRepository, tokenRepository } = createEngine();
      await engine.saveWorkflow({ id: "wf1", name: "Start to End", definition: startToEnd });

      const { process, token } = await engine.startProcess("wf1");
      expect(process.currentNodeId).toBe("start");
      expect(token.currentStep).toBe("start");

      const result = await engine.executeProcess(process.id);

      expect(result.status).toBe("COMPLETED");
      expect(result.currentNodeId).toBe("end");

      const p = await processRepository.find(process.id);
      const t = await tokenRepository.findByProcessId(process.id);
      expect(p?.status).toBe("COMPLETED");
      expect(t?.currentStep).toBe("end");
    });
  });

  describe("Workflow #2: StartEvent → Task → EndEvent", () => {
    it("pauses at Task (WAITING) and resumes to COMPLETED on next call", async () => {
      const { engine, processRepository, tokenRepository } = createEngine();
      await engine.saveWorkflow({ id: "wf2", name: "Start Task End", definition: startTaskEnd });

      const { process } = await engine.startProcess("wf2");

      // ---- first execution: StartEvent + Task → WAITING ----
      const result1 = await engine.executeProcess(process.id);
      expect(result1.status).toBe("WAITING");
      expect(result1.currentNodeId).toBe("end");

      const midProcess = await processRepository.find(process.id);
      const midToken = await tokenRepository.findByProcessId(process.id);
      expect(midProcess?.status).toBe("RUNNING");
      expect(midToken?.currentStep).toBe("end");

      // ---- external caller signals task completed ----
      await engine.completeTask(process.id);

      // ---- second execution: EndEvent → COMPLETED ----
      const result2 = await engine.executeProcess(process.id);
      expect(result2.status).toBe("COMPLETED");
      expect(result2.currentNodeId).toBe("end");

      const p = await processRepository.find(process.id);
      const t = await tokenRepository.findByProcessId(process.id);
      expect(p?.status).toBe("COMPLETED");
      expect(t?.currentStep).toBe("end");
    });
  });

  describe("Workflow #3: StartEvent → Task → Task → EndEvent", () => {
    it("pauses at each Task and completes after two resume cycles", async () => {
      const { engine, processRepository, tokenRepository } = createEngine();
      await engine.saveWorkflow({ id: "wf3", name: "Start Task Task End", definition: startTaskTaskEnd });

      const { process } = await engine.startProcess("wf3");

      // ---- first execution: StartEvent + first Task → WAITING ----
      const result1 = await engine.executeProcess(process.id);
      expect(result1.status).toBe("WAITING");
      expect(result1.currentNodeId).toBe("task2");

      let midToken = await tokenRepository.findByProcessId(process.id);
      expect(midToken?.currentStep).toBe("task2");

      // ---- complete first task ----
      await engine.completeTask(process.id);

      // ---- second execution: second Task → WAITING ----
      const result2 = await engine.executeProcess(process.id);
      expect(result2.status).toBe("WAITING");
      expect(result2.currentNodeId).toBe("end");

      midToken = await tokenRepository.findByProcessId(process.id);
      expect(midToken?.currentStep).toBe("end");

      // ---- complete second task ----
      await engine.completeTask(process.id);

      // ---- third execution: EndEvent → COMPLETED ----
      const result3 = await engine.executeProcess(process.id);
      expect(result3.status).toBe("COMPLETED");
      expect(result3.currentNodeId).toBe("end");

      const p = await processRepository.find(process.id);
      const t = await tokenRepository.findByProcessId(process.id);
      expect(p?.status).toBe("COMPLETED");
      expect(t?.currentStep).toBe("end");
    });
  });
});
