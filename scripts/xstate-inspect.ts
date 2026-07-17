import fs from "fs";
import path from "path";
import { createActor } from "xstate";
import { executionMachine } from "../src/engine/XStateWorkflow";
import { toMermaid, toDot } from "../src/visualize/workflow-visualizer";
import { WorkflowDefinition } from "../src/entities/Workflow";

const workflowFile = process.argv[2] ?? path.join(process.cwd(), "src", "workflows", "EX1.json");
const raw = fs.readFileSync(workflowFile, "utf-8");
const workflow = JSON.parse(raw) as WorkflowDefinition;

// Generate Mermaid diagram
const mermaid = toMermaid(workflow);
const mmdPath = path.join(__dirname, "workflow.mmd");
fs.writeFileSync(mmdPath, mermaid, "utf-8");
console.log(`Wrote Mermaid diagram → ${mmdPath}`);
console.log("Open in a Mermaid viewer (e.g. mermaid.live) to visualize.\n");

// Generate Graphviz DOT diagram
const dot = toDot(workflow);
const dotPath = path.join(__dirname, "workflow.dot");
fs.writeFileSync(dotPath, dot, "utf-8");
console.log(`Wrote Graphviz DOT → ${dotPath}`);
console.log("Render with: dot -Tpng scripts/workflow.dot -o scripts/workflow.png\n");

// Demonstrate the XState execution lifecycle actor
const actor = createActor(executionMachine);
actor.start();
console.log("XState lifecycle states:");
console.log(`  ${actor.getSnapshot().value}`);

actor.send({ type: "START" });
console.log(`  ${actor.getSnapshot().value}`);

actor.send({ type: "TASK_ENCOUNTERED" });
console.log(`  ${actor.getSnapshot().value}`);

actor.send({ type: "TASK_COMPLETED" });
console.log(`  ${actor.getSnapshot().value}`);

actor.send({ type: "COMPLETE" });
console.log(`  ${actor.getSnapshot().value} (done)`);
