import path from "path";
import { WorkflowEngine } from "../engine/WorkflowEngine";
import { WorkflowRepository } from "../repositories/WorkflowRepository";
import { ProcessRepository } from "../repositories/ProcessRepository";
import { TokenRepository } from "../repositories/TokenRepository";
import { Workflow, WorkflowDefinition } from "../entities/Workflow";

export function createEngine() {
  const workflowRepository = new WorkflowRepository();
  const processRepository = new ProcessRepository();
  const tokenRepository = new TokenRepository();
  const engine = new WorkflowEngine(workflowRepository, processRepository, tokenRepository);

  return { engine, workflowRepository, processRepository, tokenRepository };
}

export const linearWorkflowDefinition: WorkflowDefinition = {
  steps: {
    start: { type: "start", next: "register" },
    register: { type: "task", next: "send_email" },
    send_email: { type: "task", next: "end" },
    end: { type: "end" },
  },
};

export function createLinearWorkflow(id = "user_registration"): Workflow {
  return {
    id,
    name: "User Registration",
    definition: linearWorkflowDefinition,
  };
}

export const ex1Path = path.join(__dirname, "..", "workflows", "EX1.json");
