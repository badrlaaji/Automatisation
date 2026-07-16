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

  describe("saveWorkflow / loadWorkflow", () => {
    it("saves and loads a workflow definition", async () => {
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
      expect(process.currentNodeId).toBe("start");

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
    it("processes through the workflow, stopping at each task", async () => {
      const { engine, processRepository, tokenRepository } = createEngine();
      await engine.saveWorkflow(createLinearWorkflow());

      const { process } = await engine.startProcess("user_registration");

      // First call: process StartEvent + first Task → WAITING
      let result = await engine.executeProcess(process.id);
      expect(result.status).toBe("WAITING");
      expect(result.currentNodeId).toBe("send_email");

      let token = await tokenRepository.findByProcessId(process.id);
      expect(token?.currentStep).toBe("send_email");

      // Second call: process second Task → WAITING
      result = await engine.executeProcess(process.id);
      expect(result.status).toBe("WAITING");
      expect(result.currentNodeId).toBe("end");

      token = await tokenRepository.findByProcessId(process.id);
      expect(token?.currentStep).toBe("end");

      // Third call: process EndEvent → COMPLETED
      result = await engine.executeProcess(process.id);
      expect(result.status).toBe("COMPLETED");
      expect(result.currentNodeId).toBe("end");

      const finalProcess = await processRepository.find(process.id);
      const finalToken = await tokenRepository.findByProcessId(process.id);

      expect(finalProcess?.status).toBe("COMPLETED");
      expect(finalToken?.currentStep).toBe("end");
    });

    it("persists token position after each step", async () => {
      const { engine, tokenRepository } = createEngine();
      await engine.saveWorkflow(createLinearWorkflow());

      const { process } = await engine.startProcess("user_registration");
      await engine.executeProcess(process.id);

      const token = await tokenRepository.findByProcessId(process.id);
      expect(token?.currentStep).toBe("send_email");
    });

    it("does not re-execute a completed process", async () => {
      const { engine, processRepository } = createEngine();
      await engine.saveWorkflow(createLinearWorkflow());

      const { process } = await engine.startProcess("user_registration");
      await engine.executeProcess(process.id); // WAITING
      await engine.executeProcess(process.id); // WAITING
      await engine.executeProcess(process.id); // COMPLETED

      const result = await engine.executeProcess(process.id);
      expect(result.status).toBe("COMPLETED");

      const finalProcess = await processRepository.find(process.id);
      expect(finalProcess?.status).toBe("COMPLETED");
    });
  });

  describe("resumeAllRunning", () => {
    it("resumes execution from the persisted token position", async () => {
      const { engine, processRepository, tokenRepository } = createEngine();
      await engine.saveWorkflow(createLinearWorkflow());

      const { process } = await engine.startProcess("user_registration");

      await engine.executeProcess(process.id);

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

    it("supports multiple processes running in parallel independently", async () => {
      const { engine, processRepository, tokenRepository } = createEngine();
      await engine.saveWorkflow(createLinearWorkflow());

      const { process: processA } = await engine.startProcess("user_registration");
      const { process: processB } = await engine.startProcess("user_registration");

      await engine.executeProcess(processA.id);
      await engine.executeProcess(processB.id);

      const tokenA = await tokenRepository.findByProcessId(processA.id);
      const tokenB = await tokenRepository.findByProcessId(processB.id);

      expect(tokenA?.currentStep).toBe("send_email");
      expect(tokenB?.currentStep).toBe("send_email");

      await engine.resumeAllRunning();

      const finalA = await processRepository.find(processA.id);
      const finalB = await processRepository.find(processB.id);
      const finalTokenA = await tokenRepository.findByProcessId(processA.id);
      const finalTokenB = await tokenRepository.findByProcessId(processB.id);

      expect(finalA?.status).toBe("COMPLETED");
      expect(finalB?.status).toBe("COMPLETED");
      expect(finalTokenA?.currentStep).toBe("end");
      expect(finalTokenB?.currentStep).toBe("end");
    });
  });
});
