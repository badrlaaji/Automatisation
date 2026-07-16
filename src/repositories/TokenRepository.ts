import { prisma } from "../database/database";
import type { Token as PrismaToken } from "@prisma/client";
import { Token } from "../entities/Token";

export class TokenRepository {
  async create(processId: number, currentStep: string, snapshot?: any): Promise<Token> {
    const row = (await prisma.token.create({
      data: {
        processId,
        currentStep,
        snapshot,
      },
    })) as PrismaToken;

    return {
      id: row.id,
      processId: row.processId,
      currentStep: row.currentStep,
      snapshot: row.snapshot ?? undefined,
    };
  }

  async update(id: number, currentStep: string, snapshot?: any): Promise<void> {
    await prisma.token.update({
      where: { id },
      data: { currentStep, snapshot },
    });
  }

  async findByProcessId(processId: number): Promise<Token | null> {
    const row = (await prisma.token.findFirst({ where: { processId } })) as PrismaToken | null;
    if (!row) return null;

    return {
      id: row.id,
      processId: row.processId,
      currentStep: row.currentStep,
      snapshot: row.snapshot ?? undefined,
    };
  }
}
