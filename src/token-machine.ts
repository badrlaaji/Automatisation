import { assign, sendParent, setup } from "xstate";
import type { Graph } from "./graph";

export interface TokenContext {
  graph: Graph;
  nodeId: string;
  tokenId: string;
}

export type TokenEvent = { type: "COMPLETE_TASK" };

/** Walks forward through startEvent nodes until a task or endEvent is reached. */
function advance(graph: Graph, nodeId: string): string {
  let current = nodeId;
  while (true) {
    const node = graph[current];
    if (!node) {
      throw new Error(`Unknown node "${current}" in graph`);
    }
    if (node.type === "startEvent") {
      current = node.next;
      continue;
    }
    return current;
  }
}

export const tokenMachine = setup({
  types: {
    context: {} as TokenContext,
    events: {} as TokenEvent,
    input: {} as { graph: Graph; nodeId: string; tokenId: string },
  },
  guards: {
    atTask: ({ context }) => context.graph[context.nodeId]?.type === "task",
  },
  actions: {
    advanceFromCurrent: assign(({ context }) => ({
      nodeId: advance(context.graph, context.nodeId),
    })),
    advancePastTask: assign(({ context }) => {
      const node = context.graph[context.nodeId];
      if (!node || node.type !== "task") return {};
      return { nodeId: node.next };
    }),
    notifyParentDone: sendParent(({ context }) => ({
      type: "TOKEN_DONE" as const,
      tokenId: context.tokenId,
    })),
  },
}).createMachine({
  id: "token",
  context: ({ input }) => ({
    graph: input.graph,
    nodeId: input.nodeId,
    tokenId: input.tokenId,
  }),
  initial: "running",
  states: {
    running: {
      entry: "advanceFromCurrent",
      always: [
        { guard: "atTask", target: "waiting" },
        { target: "done" },
      ],
    },
    waiting: {
      on: {
        COMPLETE_TASK: {
          target: "running",
          actions: "advancePastTask",
        },
      },
    },
    done: {
      entry: "notifyParentDone",
      type: "final",
    },
  },
});
