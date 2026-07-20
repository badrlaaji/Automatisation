import type { Graph, Token, Waitpoint } from "./graph";

export interface ExecutionResult {
  tokens: Token[];
  waitpoints: Waitpoint[];
}

/**
 * Advances every token through the graph until each one is either blocked
 * on a waitpoint or has been consumed by an end event.
 */
export function runToBlocked(graph: Graph, tokens: Token[]): ExecutionResult {
  const resultTokens: Token[] = [];
  const waitpoints: Waitpoint[] = [];

  for (const token of tokens) {
    let current: Token = token;

    while (true) {
      const node = graph[current.nodeId];
      if (!node) {
        throw new Error(`Unknown node "${current.nodeId}" in graph`);
      }

      if (node.type === "startEvent") {
        current = { ...current, nodeId: node.next };
        continue;
      }

      if (node.type === "task") {
        resultTokens.push(current);
        waitpoints.push({
          tokenId: current.id,
          nodeId: node.id,
          type: "task",
        });
        break;
      }

      if (node.type === "endEvent") {
        // token is consumed; nothing to push
        break;
      }
    }
  }

  return { tokens: resultTokens, waitpoints };
}
