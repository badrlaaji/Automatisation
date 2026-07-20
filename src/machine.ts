import { assign, sendTo, setup, type ActorRefFrom, type SnapshotFrom } from "xstate";
import type { Graph, Token, Waitpoint } from "./graph";
import { tokenMachine } from "./token-machine";

export interface BpmnEngineContext {
  graph: Graph;
  tokenRefs: Record<string, ActorRefFrom<typeof tokenMachine>>;
}

export type BpmnEngineEvent =
  | { type: "START" }
  | { type: "COMPLETE_TASK"; tokenId: string }
  /** Internal: sent by a token actor when it reaches an endEvent. */
  | { type: "TOKEN_DONE"; tokenId: string };

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
  actors: {
    tokenLogic: tokenMachine,
  },
  guards: {
    tokenExists: ({ context, event }) =>
      event.type === "COMPLETE_TASK" && event.tokenId in context.tokenRefs,
    allTokensDone: ({ context }) =>
      Object.keys(context.tokenRefs).length === 0,
  },
  actions: {
    spawnToken: assign(({ context, spawn }) => {
      const tokenId = nextTokenId();
      const ref = spawn("tokenLogic", {
        id: tokenId,
        input: {
          graph: context.graph,
          nodeId: findStartNodeId(context.graph),
          tokenId,
        },
      });
      return { tokenRefs: { ...context.tokenRefs, [tokenId]: ref } };
    }),
    forwardCompleteTask: sendTo(
      ({ context, event }) => {
        if (event.type !== "COMPLETE_TASK") {
          throw new Error("forwardCompleteTask called with wrong event");
        }
        return context.tokenRefs[event.tokenId];
      },
      { type: "COMPLETE_TASK" },
    ),
    removeTokenRef: assign(({ context, event }) => {
      if (event.type !== "TOKEN_DONE") return {};
      const { [event.tokenId]: _removed, ...rest } = context.tokenRefs;
      return { tokenRefs: rest };
    }),
  },
}).createMachine({
  id: "bpmnEngine",
  context: ({ input }) => ({
    graph: input.graph,
    tokenRefs: {},
  }),
  initial: "idle",
  states: {
    idle: {
      on: {
        START: {
          target: "active",
          actions: "spawnToken",
        },
      },
    },
    active: {
      on: {
        COMPLETE_TASK: {
          guard: "tokenExists",
          actions: "forwardCompleteTask",
        },
        TOKEN_DONE: {
          actions: "removeTokenRef",
        },
      },
      always: [{ guard: "allTokensDone", target: "completed" }],
    },
    completed: {
      type: "final",
    },
  },
});

/** Derives the current waitpoints by reading every waiting token actor's snapshot. */
export function getWaitpoints(
  snapshot: SnapshotFrom<typeof bpmnEngineMachine>,
): Waitpoint[] {
  const waitpoints: Waitpoint[] = [];
  for (const [tokenId, ref] of Object.entries(snapshot.context.tokenRefs)) {
    const tokenSnapshot = ref.getSnapshot();
    if (tokenSnapshot.value === "waiting") {
      waitpoints.push({
        tokenId,
        nodeId: tokenSnapshot.context.nodeId,
        type: "task",
      });
    }
  }
  return waitpoints;
}

/** Derives the current tokens by reading every active token actor's snapshot. */
export function getTokens(
  snapshot: SnapshotFrom<typeof bpmnEngineMachine>,
): Token[] {
  return Object.entries(snapshot.context.tokenRefs).map(([tokenId, ref]) => ({
    id: tokenId,
    nodeId: ref.getSnapshot().context.nodeId,
  }));
}
