import fs from "fs";
import { createActor } from "xstate";
import { Workflow, WorkflowDefinition, NodeType } from "../entities/Workflow";
import { ProcessInstance } from "../entities/ProcessInstance";
import { Token } from "../entities/Token";
import { WorkflowRepository } from "../repositories/WorkflowRepository";
import { ProcessRepository } from "../repositories/ProcessRepository";
import { TokenRepository } from "../repositories/TokenRepository";
import { executionMachine, ExecutionMachineState } from "./XStateWorkflow";

export type ExecutionStatus = "COMPLETED" | "WAITING";

export interface ExecutionResult {
  status: ExecutionStatus;
  currentNodeId: string;
}

export class WorkflowEngine {
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

  async saveWorkflow(workflow: Workflow): Promise<void> {
    await this.workflowRepository.saveWorkflow(workflow);
  }

  async loadWorkflow(id: string): Promise<Workflow | null> {
    return this.workflowRepository.findWorkflow(id);
  }

  async startProcess(workflowId: string): Promise<{ process: ProcessInstance; token: Token }> {
    const workflow = await this.loadWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const startNodeId = this.findStartNodeId(workflow.definition);
    const process = await this.processRepository.create(workflowId);

    const actor = createActor(executionMachine);
    actor.start();
    const snapshot = actor.getPersistedSnapshot();

    const token = await this.tokenRepository.create(process.id, startNodeId, snapshot);

    return { process: { ...process, currentNodeId: startNodeId }, token };
  }

  async completeTask(processId: number, tokenId?: number): Promise<void> {
    const token = tokenId
      ? await this.tokenRepository.find(tokenId)
      : await this.tokenRepository.findByProcessId(processId);

    if (!token) {
      throw new Error(`Token not found for process: ${processId}`);
    }
    if (token.processId !== processId) {
      throw new Error(`Token ${token.id} does not belong to process ${processId}`);
    }

    const actor = createActor(
      executionMachine,
      token.snapshot ? { state: token.snapshot as any } : undefined
    );
    actor.start();

    const state = actor.getSnapshot().value as ExecutionMachineState;
    if (state !== "Waiting") {
      throw new Error(`Cannot complete task: process ${processId} is in state "${state}", expected "Waiting"`);
    }

    actor.send({ type: "TASK_COMPLETED", tokenId: token.id });
    await this.tokenRepository.update(token.id, token.currentStep, actor.getPersistedSnapshot());
  }

  async startAndComplete(workflowId: string): Promise<void> {
    const { process } = await this.startProcess(workflowId);
    let result = await this.executeProcess(process.id);
    while (result.status === "WAITING") {
      await this.completeTask(process.id);
      result = await this.executeProcess(process.id);
    }
  }

  async executeProcess(processId: number): Promise<ExecutionResult> {
    const process = await this.processRepository.find(processId);
    if (!process) {
      throw new Error(`Process not found: ${processId}`);
    }

    if (process.status === "COMPLETED") {
      return { status: "COMPLETED", currentNodeId: "" };
    }

    const workflow = await this.loadWorkflow(process.workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${process.workflowId}`);
    }

    const token = await this.tokenRepository.findByProcessId(processId);
    if (!token) {
      return { status: "WAITING", currentNodeId: process.currentNodeId ?? "" };
    }

    const actor = createActor(
      executionMachine,
      token.snapshot ? { state: token.snapshot as any } : undefined
    );
    actor.start();

    const state = actor.getSnapshot().value as ExecutionMachineState;

    if (state === "Idle") {
      actor.send({ type: "START" });
    } else if (state === "Waiting") {
      return { status: "WAITING", currentNodeId: token.currentStep };
    } else if (state === "Completed") {
      return { status: "COMPLETED", currentNodeId: "" };
    }

    return this.runInterpretLoop(process, token, workflow.definition, actor);
  }

  async resumeAllRunning(): Promise<void> {
    const running = await this.processRepository.findRunning();
    console.log(`Resuming ${running.length} running process(es)...`);

    for (const process of running) {
      let result = await this.executeProcess(process.id);
      while (result.status === "WAITING") {
        await this.completeTask(process.id);
        result = await this.executeProcess(process.id);
      }
    }
  }

  private async runInterpretLoop(
    process: ProcessInstance,
    token: Token,
    definition: WorkflowDefinition,
    actor: ReturnType<typeof createActor<typeof executionMachine>>
  ): Promise<ExecutionResult> {
    let currentNodeId = token.currentStep;

    while (true) {
      const nodeType = this.resolveNodeType(currentNodeId, definition);

      switch (nodeType) {
        case "StartEvent": {
          console.log(`[START] Entering workflow at "${currentNodeId}"`);
          const nextNodeId = this.resolveNextNodeId(currentNodeId, definition);
          if (!nextNodeId) {
            actor.send({ type: "COMPLETE" });
            return await this.complete(process, token, currentNodeId, actor);
          }
          currentNodeId = nextNodeId;
          await this.tokenRepository.update(token.id, currentNodeId, actor.getPersistedSnapshot());
          break;
        }

        case "Task": {
          console.log(`[TASK] Executing "${currentNodeId}"`);
          const nextNodeId = this.resolveNextNodeId(currentNodeId, definition);
          if (!nextNodeId) {
            actor.send({ type: "COMPLETE" });
            return await this.complete(process, token, currentNodeId, actor);
          }
          currentNodeId = nextNodeId;
          actor.send({ type: "TASK_ENCOUNTERED" });
          await this.tokenRepository.update(token.id, currentNodeId, actor.getPersistedSnapshot());
          return { status: "WAITING", currentNodeId };
        }

        case "EndEvent": {
          console.log(`[END] Reached "${currentNodeId}"`);
          actor.send({ type: "COMPLETE" });
          return await this.complete(process, token, currentNodeId, actor);
        }

        default:
          throw new Error(`Unknown node type at "${currentNodeId}"`);
      }
    }
  }

  private async complete(
    process: ProcessInstance,
    token: Token,
    currentNodeId: string,
    actor: ReturnType<typeof createActor<typeof executionMachine>>
  ): Promise<ExecutionResult> {
    await this.tokenRepository.update(token.id, currentNodeId, actor.getPersistedSnapshot());
    await this.processRepository.updateStatus(process.id, "COMPLETED");
    console.log(`Process #${process.id} COMPLETED`);
    return { status: "COMPLETED", currentNodeId };
  }

  private resolveNodeType(nodeId: string, definition: WorkflowDefinition): NodeType {
    if (definition.nodes) {
      const node = definition.nodes.find((n) => n.id === nodeId);
      if (node) return node.type;
    }

    const step = definition.steps[nodeId];
    if (!step) {
      throw new Error(`Node/step not found: "${nodeId}"`);
    }

    switch (step.type) {
      case "start":
        return "StartEvent";
      case "task":
        return "Task";
      case "end":
        return "EndEvent";
      default:
        throw new Error(`Unsupported step type: "${step.type}" at "${nodeId}"`);
    }
  }

  private resolveNextNodeId(nodeId: string, definition: WorkflowDefinition): string | null {
    if (definition.nodes) {
      const node = definition.nodes.find((n) => n.id === nodeId);
      if (node && node.outgoing.length > 0) {
        return node.outgoing[0].target;
      }
      if (definition.sequenceFlows) {
        const flow = definition.sequenceFlows.find((f) => f.source === nodeId);
        if (flow) return flow.target;
      }
    }

    const step = definition.steps[nodeId];
    return step?.next ?? null;
  }

  private findStartNodeId(definition: WorkflowDefinition): string {
    if (definition.nodes) {
      const startNode = definition.nodes.find((n) => n.type === "StartEvent");
      if (startNode) return startNode.id;
    }

    if (definition.startState) {
      return definition.startState;
    }

    for (const [stepId, step] of Object.entries(definition.steps)) {
      if (step.type === "start") {
        return stepId;
      }
    }

    throw new Error("No start node found in workflow definition");
  }
}
