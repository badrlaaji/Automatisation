import path from "path";
import { prisma } from "./database/database";
import { WorkflowEngine } from "./engine/WorkflowEngine";
import { WorkflowRepository } from "./repositories/WorkflowRepository";
import { ProcessRepository } from "./repositories/ProcessRepository";
import { TokenRepository } from "./repositories/TokenRepository";

async function seedWorkflow(engine: WorkflowEngine) {
  const ex1Path = path.join(__dirname, "workflows", "EX1.json");
  const workflow = engine.loadWorkflowFromFile(ex1Path, "user_registration", "User Registration");
  await engine.saveWorkflow(workflow);
  return workflow;
}

async function printState(processRepository: ProcessRepository, tokenRepository: TokenRepository, processId: number) {
  const process = await processRepository.find(processId);
  const token = await tokenRepository.findByProcessId(processId);
  console.log(`  Process #${processId} — status: ${process?.status}`);
  console.log(`  Token — current step: ${token?.currentStep}`);
}

async function runFullDemo(engine: WorkflowEngine, processRepository: ProcessRepository, tokenRepository: TokenRepository) {
  console.log("=== Full workflow execution ===\n");

  const workflow = await seedWorkflow(engine);
  console.log(`Loaded workflow: ${workflow.name} (${workflow.id})`);
  console.log(`Graph: ${Object.keys(workflow.definition.steps).join(" → ")}\n`);

  const { process } = await engine.startProcess(workflow.id);
  console.log("Created process + token:");
  await printState(processRepository, tokenRepository, process.id);
  console.log();

  await engine.executeProcess(process.id);
  console.log("\nFinal state:");
  await printState(processRepository, tokenRepository, process.id);
}

async function runCrashResumeDemo(
  engine: WorkflowEngine,
  processRepository: ProcessRepository,
  tokenRepository: TokenRepository
) {
  console.log("=== Crash & resume demo ===\n");

  const workflow = await seedWorkflow(engine);
  const { process } = await engine.startProcess(workflow.id);

  console.log("Running first steps then simulating crash...\n");
  await engine.executeProcess(process.id);

  console.log("\nState saved in database:");
  await printState(processRepository, tokenRepository, process.id);

  console.log("\n--- Application restart ---\n");
  await engine.resumeAllRunning();

  console.log("\nFinal state after resume:");
  await printState(processRepository, tokenRepository, process.id);
}

async function main() {
  const workflowRepository = new WorkflowRepository();
  const processRepository = new ProcessRepository();
  const tokenRepository = new TokenRepository();
  const engine = new WorkflowEngine(workflowRepository, processRepository, tokenRepository);

  const mode = process.argv[2] ?? "full";

  if (mode === "resume") {
    console.log("=== Resume running processes ===\n");
    await engine.resumeAllRunning();
  } else if (mode === "crash") {
    await runCrashResumeDemo(engine, processRepository, tokenRepository);
  } else {
    await runFullDemo(engine, processRepository, tokenRepository);
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
