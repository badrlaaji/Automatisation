/// <reference types="node" />
import fs from "fs";
import path from "path";
import { interpret } from "xstate";
import { buildMachine } from "../src/engine/XStateWorkflow";
import { WorkflowDefinition } from "../src/entities/Workflow";

const workflowFile = process.argv[2] ?? path.join(process.cwd(), "src", "workflows", "EX1.json");
const raw = fs.readFileSync(workflowFile, "utf-8");
const workflow = JSON.parse(raw) as WorkflowDefinition;

const machine = buildMachine(workflow);
const service = interpret(machine);
let currentState: any = null;
service.subscribe((s) => {
  currentState = s;
  console.log("State:", s.value);
});
service.start();

// Simulate advancing the token every 1s until final
const advance = setInterval(() => {
  if (currentState && currentState.done) {
    console.log("Workflow finished.");
    clearInterval(advance);
    process.exit(0);
  } else {
    service.send({ type: "NEXT" });
  }
}, 1000);

// Keep process alive for inspector connection
process.on("SIGINT", () => {
  console.log("Stopping...");
  service.stop();
  process.exit(0);
});

// Generate a Mermaid state diagram for visualization
const mermaidLines = ["stateDiagram-v2"];
for (const [id, step] of Object.entries(workflow.steps)) {
  const next = step.next;
  if (next) {
    mermaidLines.push(`    ${id} --> ${next}`);
  } else if (step.type === "end") {
    mermaidLines.push(`    ${id} --> [*]`);
  }
}
const mermaid = mermaidLines.join("\n");
fs.writeFileSync(path.join(__dirname, "workflow.mmd"), mermaid, "utf-8");
console.log("Wrote Mermaid diagram to scripts/workflow.mmd — open in a Mermaid viewer to visualize.");
