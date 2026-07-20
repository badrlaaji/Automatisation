import { describe, expect, it } from "vitest";
import type { Graph } from "./graph";
import { runToBlocked } from "./execution";

const graph: Graph = {
  start: { id: "start", type: "startEvent", next: "review" },
  review: { id: "review", type: "task", next: "end" },
  end: { id: "end", type: "endEvent" },
};

describe("runToBlocked", () => {
  it("advances a token through the startEvent and stops at the task", () => {
    const result = runToBlocked(graph, [{ id: "t1", nodeId: "start" }]);

    expect(result.tokens).toEqual([{ id: "t1", nodeId: "review" }]);
    expect(result.waitpoints).toEqual([
      { tokenId: "t1", nodeId: "review", type: "task" },
    ]);
  });

  it("consumes a token that reaches the endEvent", () => {
    const result = runToBlocked(graph, [{ id: "t1", nodeId: "end" }]);

    expect(result.tokens).toEqual([]);
    expect(result.waitpoints).toEqual([]);
  });

  it("throws on an unknown node id", () => {
    expect(() =>
      runToBlocked(graph, [{ id: "t1", nodeId: "missing" }]),
    ).toThrow(/Unknown node/);
  });

  it("processes multiple tokens independently", () => {
    const result = runToBlocked(graph, [
      { id: "t1", nodeId: "start" },
      { id: "t2", nodeId: "review" },
    ]);

    expect(result.tokens).toHaveLength(2);
    expect(result.waitpoints).toHaveLength(2);
    expect(result.waitpoints.map((wp) => wp.tokenId).sort()).toEqual([
      "t1",
      "t2",
    ]);
  });
});
