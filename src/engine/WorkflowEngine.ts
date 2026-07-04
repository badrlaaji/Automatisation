import fs from "fs";
import path from "path";
import { Workflow, WorkflowDefinition, WorkflowStep } from "../entities/Workflow";
import { ProcessInstance } from "../entities/ProcessInstance";
import { Token } from "../entities/Token";
import { WorkflowRepository } from "../repositories/WorkflowRepository";
import { ProcessRepository } from "../repositories/ProcessRepository";
import { TokenRepository } from "../repositories/TokenRepository";

export class WorkflowEngine {
  private graph: Map<string, WorkflowStep> = new Map();

  constructor(
    private workflowRepository: WorkflowRepository,
    private processRepository: ProcessRepository,
    private tokenRepository: TokenRepository
  ) {}

  loadWorkflowFromFile(filePath: string, id: string, name: string): Workflow {
    const raw = fs.readFileSync(filePath, "utf-8");
    const definition = JSON.parse(raw) as WorkflowDefinition;
    return { id, name, definition };
  }

  buildGraph(definition: WorkflowDefinition): void {
    this.graph = new Map(Object.entries(definition.steps));
  }

  async saveWorkflow(workflow: Workflow): Promise<void> {
    await this.workflowRepository.saveWorkflow(workflow);
    this.buildGraph(workflow.definition);
  }

  async loadWorkflow(id: string): Promise<Workflow | null> {
    const workflow = await this.workflowRepository.findWorkflow(id);
    if (!workflow) return null;

    this.buildGraph(workflow.definition);
    return workflow;
  }

  async startProcess(workflowId: string): Promise<{ process: ProcessInstance; token: Token }> {
    const workflow = await this.loadWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const startStep = this.findStartStep();
    const process = await this.processRepository.create(workflowId);
    const token = await this.tokenRepository.create(process.id, startStep);

    return { process, token };
  }

  async executeProcess(processId: number, maxSteps?: number): Promise<void> {
    const process = await this.processRepository.find(processId);
    if (!process) {
      throw new Error(`Process not found: ${processId}`);
    }

    if (process.status === "COMPLETED") {
      console.log(`Process #${processId} already completed.`);
      return;
    }

    const workflow = await this.loadWorkflow(process.workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${process.workflowId}`);
    }

    const token = await this.tokenRepository.findByProcessId(processId);
    if (!token) {
      throw new Error(`Token not found for process: ${processId}`);
    }

    await this.runExecutionLoop(process, token, maxSteps);
  }

  async resumeAllRunning(): Promise<void> {
    const running = await this.processRepository.findRunning();
    console.log(`Resuming ${running.length} running process(es)...`);

    for (const process of running) {
      await this.executeProcess(process.id);
    }
  }

  private async runExecutionLoop(
    process: ProcessInstance,
    token: Token,
    maxSteps?: number
  ): Promise<void> {
    let currentProcess = process;
    let currentToken = token;
    let stepsExecuted = 0;

    while (currentProcess.status !== "COMPLETED") {
      if (maxSteps !== undefined && stepsExecuted >= maxSteps) {
        console.log(`Paused after ${maxSteps} step(s) — token at: ${currentToken.currentStep}`);
        break;
      }
      const step = this.graph.get(currentToken.currentStep);
      if (!step) {
        throw new Error(`Step not found in graph: ${currentToken.currentStep}`);
      }

      this.executeStep(currentToken.currentStep, step);
      stepsExecuted++;

      if (step.type === "end") {
        await this.processRepository.updateStatus(currentProcess.id, "COMPLETED");
        currentProcess = { ...currentProcess, status: "COMPLETED" };
        console.log(`Process #${currentProcess.id} COMPLETED`);
        break;
      }

      if (!step.next) {
        throw new Error(`Step "${currentToken.currentStep}" has no next step`);
      }

      currentToken = { ...currentToken, currentStep: step.next };
      await this.tokenRepository.update(currentToken.id, currentToken.currentStep);
      console.log(`Token moved to: ${currentToken.currentStep}`);
    }
  }

  private executeStep(stepId: string, step: WorkflowStep): void {
    if (step.type === "start") {
      console.log(`[START] Entering workflow at "${stepId}"`);
      return;
    }

    if (step.type === "task") {
      console.log(`[TASK] Executing "${stepId}"`);
      return;
    }

    console.log(`[END] Reached "${stepId}"`);
  }

  private findStartStep(): string {
    for (const [stepId, step] of this.graph.entries()) {
      if (step.type === "start") {
        return stepId;
      }
    }
    throw new Error("No start step found in workflow definition");
  }
}
