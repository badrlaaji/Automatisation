import { describe, it, expect } from "vitest";
import { WorkflowRepository } from "./WorkflowRepository";
import { createLinearWorkflow } from "../test/helpers";

describe("WorkflowRepository", () => {
  it("saves and finds a workflow", async () => {
    const repo = new WorkflowRepository();
    const workflow = createLinearWorkflow("wf_save_find");

    await repo.saveWorkflow(workflow);
    const found = await repo.findWorkflow("wf_save_find");

    expect(found).toEqual(workflow);
  });

  it("returns null for unknown workflow", async () => {
    const repo = new WorkflowRepository();
    const found = await repo.findWorkflow("does_not_exist");

    expect(found).toBeNull();
  });

  it("updates an existing workflow on save", async () => {
    const repo = new WorkflowRepository();
    const workflow = createLinearWorkflow("wf_update");

    await repo.saveWorkflow(workflow);
    await repo.saveWorkflow({ ...workflow, name: "Updated Name" });

    const found = await repo.findWorkflow("wf_update");
    expect(found?.name).toBe("Updated Name");
  });
});
