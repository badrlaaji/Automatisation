export type ProcessStatus = "RUNNING" | "COMPLETED";

export interface ProcessInstance {
  id: number;
  workflowId: string;
  currentNodeId?: string;
  status: ProcessStatus;
}
