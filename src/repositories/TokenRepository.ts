import { prisma } from "../database/database";
import { Token } from "../entities/Token";

export class TokenRepository {
  async create(processId: number, currentStep: string): Promise<Token> {
    const row = await prisma.token.create({
      data: {
        processId,
        currentStep,
      },
    });

    return {
      id: row.id,
      processId: row.processId,
      currentStep: row.currentStep,
    };
  }

  async update(id: number, currentStep: string): Promise<void> {
    await prisma.token.update({
      where: { id },
      data: { currentStep },
    });
  }

  async findByProcessId(processId: number): Promise<Token | null> {
    const row = await prisma.token.findFirst({ where: { processId } });
    if (!row) return null;

    return {
      id: row.id,
      processId: row.processId,
      currentStep: row.currentStep,
    };
  }
}
