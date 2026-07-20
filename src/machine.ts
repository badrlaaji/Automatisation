import { assign, setup } from "xstate";
import type { Graph, Token, Waitpoint } from "./graph";
import { runToBlocked } from "./execution";

export interface BpmnEngineContext {
  graph: Graph;
  tokens: Token[];
  waitpoints: Waitpoint[];
}

export type BpmnEngineEvent =
  | { type: "START" }
  | { type: "COMPLETE_TASK"; tokenId: string };

let tokenCounter = 0;
function nextTokenId(): string {
  tokenCounter += 1;
  return `token-${tokenCounter}`;
}

function findStartNodeId(graph: Graph): string {
  const startNode = Object.values(graph).find(
    (node) => node.type === "startEvent",
  );
  if (!startNode) {
    throw new Error("Graph has no startEvent");
  }
  return startNode.id;
}

export const bpmnEngineMachine = setup({
  types: {
    context: {} as BpmnEngineContext,
    events: {} as BpmnEngineEvent,
    input: {} as { graph: Graph },
  },
  actions: {
    spawnInitialToken: assign(({ context }) => ({
      tokens: [
        ...context.tokens,
        { id: nextTokenId(), nodeId: findStartNodeId(context.graph) },
      ],
    })),
    runExecution: assign(({ context }) => {
      const result = runToBlocked(context.graph, context.tokens);
      return { tokens: result.tokens, waitpoints: result.waitpoints };
    }),
    advanceCompletedTask: assign(({ context, event }) => {
      if (event.type !== "COMPLETE_TASK") return {};

      const waitpoint = context.waitpoints.find(
        (wp) => wp.tokenId === event.tokenId,
      );
      if (!waitpoint) return {};

      const taskNode = context.graph[waitpoint.nodeId];
      if (!taskNode || taskNode.type !== "task") return {};

      return {
        tokens: context.tokens.map((token) =>
          token.id === event.tokenId
            ? { ...token, nodeId: taskNode.next }
            : token,
        ),
        waitpoints: context.waitpoints.filter(
          (wp) => wp.tokenId !== event.tokenId,
        ),
      };
    }),
  },
  guards: {
    hasWaitpoints: ({ context }) => context.waitpoints.length > 0,
  },
}).createMachine({
  id: "bpmnEngine",
  context: ({ input }) => ({
    graph: input.graph,
    tokens: [],
    waitpoints: [],
  }),
  initial: "idle",
  states: {
    idle: {
      on: {
        START: {
          target: "executing",
          actions: "spawnInitialToken",
        },
      },
    },
    executing: {
      entry: "runExecution",
      always: [
        { guard: "hasWaitpoints", target: "waiting" },
        { target: "completed" },
      ],
    },
    waiting: {
      on: {
        COMPLETE_TASK: {
          target: "executing",
          actions: "advanceCompletedTask",
        },
      },
    },
    completed: {
      type: "final",
    },
  },
});
