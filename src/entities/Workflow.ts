export type StepType = "start" | "task" | "end";

export interface WorkflowStep {
  type: StepType;
  next?: string;
}

export interface WorkflowDefinition {
  steps: Record<string, WorkflowStep>;
}

export interface Workflow {
  id: string;
  name: string;
  definition: WorkflowDefinition;
}
