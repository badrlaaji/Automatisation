import { prisma } from "../database/database";
import { ProcessInstance, ProcessStatus } from "../entities/ProcessInstance";

export class ProcessRepository {
  async create(workflowId: string): Promise<ProcessInstance> {
    const row = await prisma.processInstance.create({
      data: {
        workflowId,
        status: "RUNNING",
      },
    });

    return {
      id: row.id,
      workflowId: row.workflowId,
      status: row.status as ProcessStatus,
    };
  }

  async updateStatus(id: number, status: ProcessStatus): Promise<void> {
    await prisma.processInstance.update({
      where: { id },
      data: { status },
    });
  }

  async find(id: number): Promise<ProcessInstance | null> {
    const row = await prisma.processInstance.findUnique({ where: { id } });
    if (!row) return null;

    return {
      id: row.id,
      workflowId: row.workflowId,
      status: row.status as ProcessStatus,
    };
  }

  async findRunning(): Promise<ProcessInstance[]> {
    const rows = await prisma.processInstance.findMany({
      where: { status: "RUNNING" },
    });

    return rows.map((row) => ({
      id: row.id,
      workflowId: row.workflowId,
      status: row.status as ProcessStatus,
    }));
  }
}
