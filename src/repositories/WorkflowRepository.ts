import { prisma } from "../database/database";
import { Workflow, WorkflowDefinition } from "../entities/Workflow";

export class WorkflowRepository {
  async saveWorkflow(workflow: Workflow): Promise<void> {
    await prisma.workflow.upsert({
      where: { id: workflow.id },
      create: {
        id: workflow.id,
        name: workflow.name,
        definition: JSON.stringify(workflow.definition),
      },
      update: {
        name: workflow.name,
        definition: JSON.stringify(workflow.definition),
      },
    });
  }

  async findWorkflow(id: string): Promise<Workflow | null> {
    const row = await prisma.workflow.findUnique({ where: { id } });
    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      definition: JSON.parse(row.definition) as WorkflowDefinition,
    };
  }
}
