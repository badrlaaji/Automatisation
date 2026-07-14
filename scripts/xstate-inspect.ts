// @ts-nocheck
import fs from "fs";
import path from "path";
import { createMachine, interpret } from "xstate";
// Try to start the XState inspector (if installed) so you can use the Stately visualizer
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const inspectPkg = require("@xstate/inspect");
  if (inspectPkg && typeof inspectPkg.inspect === "function") {
    inspectPkg.inspect({ iframe: false });
    console.log("@xstate/inspect started — open https://stately.ai/viz to connect.");
  }
} catch (err) {
  // ignore if not installed
}

const wfPath = path.join(__dirname, "..", "src", "workflows", "EX1.json");
const raw = fs.readFileSync(wfPath, "utf-8");
const wf = JSON.parse(raw);

const states: Record<string, any> = {};
for (const [id, step] of Object.entries(wf.steps)) {
  if ((step as any).type === "end") {
    states[id] = { type: "final" };
  } else {
    const next = (step as any).next;
    states[id] = { on: next ? { NEXT: next } : {} };
  }
}

const machineSpec = JSON.parse(JSON.stringify({ id: "workflow", initial: "start", states }));
const machine = createMachine(machineSpec as any);

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
for (const [id, step] of Object.entries(wf.steps)) {
  const next = (step as any).next;
  if (next) {
    mermaidLines.push(`    ${id} --> ${next}`);
  } else if ((step as any).type === "end") {
    mermaidLines.push(`    ${id} --> [*]`);
  }
}
const mermaid = mermaidLines.join("\n");
fs.writeFileSync(path.join(__dirname, "workflow.mmd"), mermaid, "utf-8");
console.log("Wrote Mermaid diagram to scripts/workflow.mmd — open in a Mermaid viewer to visualize.");
