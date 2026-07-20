export interface StartEvent {
  id: string;
  type: "startEvent";
  next: string;
}

export interface Task {
  id: string;
  type: "task";
  next: string;
}

export interface EndEvent {
  id: string;
  type: "endEvent";
}

export type Node = StartEvent | Task | EndEvent;

export type Graph = Record<string, Node>;

export interface Token {
  id: string;
  nodeId: string;
}

export interface Waitpoint {
  tokenId: string;
  nodeId: string;
  type: "task";
}
