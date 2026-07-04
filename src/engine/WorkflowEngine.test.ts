import { describe, it, expect } from "vitest";
import {
  createEngine,
  createLinearWorkflow,
  ex1Path,
} from "../test/helpers";

describe("WorkflowEngine", () => {
  describe("loadWorkflowFromFile", () => {
    it("loads a workflow definition from JSON", () => {
      const { engine } = createEngine();
      const workflow = engine.loadWorkflowFromFile(ex1Path, "user_registration", "User Registration");

      expect(workflow.id).toBe("user_registration");
      expect(workflow.name).toBe("User Registration");
      expect(workflow.definition.steps.start).toEqual({ type: "start", next: "register" });
      expect(workflow.definition.steps.end).toEqual({ type: "end" });
    });
  });

  describe("buildGraph", () => {
    it("builds a graph from a workflow definition", async () => {
      const { engine } = createEngine();
      const workflow = createLinearWorkflow();

      await engine.saveWorkflow(workflow);
      const loaded = await engine.loadWorkflow(workflow.id);

      expect(loaded).not.toBeNull();
      expect(loaded!.definition.steps).toEqual(workflow.definition.steps);
    });
  });

  describe("startProcess", () => {
    it("creates a running process and token at the start step", async () => {
      const { engine, processRepository, tokenRepository } = createEngine();
      await engine.saveWorkflow(createLinearWorkflow());

      const { process, token } = await engine.startProcess("user_registration");

      expect(process.status).toBe("RUNNING");
      expect(process.workflowId).toBe("user_registration");

      const persistedProcess = await processRepository.find(process.id);
      const persistedToken = await tokenRepository.findByProcessId(process.id);

      expect(persistedProcess?.status).toBe("RUNNING");
      expect(persistedToken?.currentStep).toBe("start");
      expect(token.currentStep).toBe("start");
    });

    it("throws when workflow does not exist", async () => {
      const { engine } = createEngine();

      await expect(engine.startProcess("missing")).rejects.toThrow("Workflow not found: missing");
    });
  });

  describe("executeProcess", () => {
    it("runs all steps and completes the process", async () => {
      const { engine, processRepository, tokenRepository } = createEngine();
      await engine.saveWorkflow(createLinearWorkflow());

      const { process } = await engine.startProcess("user_registration");
      await engine.executeProcess(process.id);

      const finalProcess = await processRepository.find(process.id);
      const finalToken = await tokenRepository.findByProcessId(process.id);

      expect(finalProcess?.status).toBe("COMPLETED");
      expect(finalToken?.currentStep).toBe("end");
    });

    it("persists token position after each step", async () => {
      const { engine, tokenRepository } = createEngine();
      await engine.saveWorkflow(createLinearWorkflow());

      const { process } = await engine.startProcess("user_registration");
      await engine.executeProcess(process.id, 2);

      const token = await tokenRepository.findByProcessId(process.id);
      expect(token?.currentStep).toBe("send_email");
    });

    it("does not re-execute a completed process", async () => {
      const { engine, processRepository } = createEngine();
      await engine.saveWorkflow(createLinearWorkflow());

      const { process } = await engine.startProcess("user_registration");
      await engine.executeProcess(process.id);
      await engine.executeProcess(process.id);

      const finalProcess = await processRepository.find(process.id);
      expect(finalProcess?.status).toBe("COMPLETED");
    });
  });

  describe("resumeAllRunning", () => {
    it("resumes execution from the persisted token position", async () => {
      const { engine, processRepository, tokenRepository } = createEngine();
      await engine.saveWorkflow(createLinearWorkflow());

      const { process } = await engine.startProcess("user_registration");
      await engine.executeProcess(process.id, 2);

      const midProcess = await processRepository.find(process.id);
      const midToken = await tokenRepository.findByProcessId(process.id);
      expect(midProcess?.status).toBe("RUNNING");
      expect(midToken?.currentStep).toBe("send_email");

      await engine.resumeAllRunning();

      const finalProcess = await processRepository.find(process.id);
      const finalToken = await tokenRepository.findByProcessId(process.id);
      expect(finalProcess?.status).toBe("COMPLETED");
      expect(finalToken?.currentStep).toBe("end");
    });
  });
});
