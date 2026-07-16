export type StepType = "start" | "task" | "end" | "waitEvent";

export interface WorkflowStep {
  type: StepType;
  next?: string;
  // present when type === 'waitEvent'
  event?: string;
  // present when type === 'task'
  action?: string;
}

export type NodeType = "StartEvent" | "Task" | "EndEvent";

export interface SequenceFlow {
  id: string;
  source: string;
  target: string;
}

export interface Node {
  id: string;
  type: NodeType;
  outgoing: SequenceFlow[];
}

export interface WorkflowDefinition {
  id?: string;
  nodes?: Node[];
  sequenceFlows?: SequenceFlow[];
  steps: Record<string, WorkflowStep>;
  startState?: string;
}

export interface Workflow {
  id: string;
  name: string;
  definition: WorkflowDefinition;
}
