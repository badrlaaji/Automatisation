import { WorkflowDefinition } from "../entities/Workflow";

export function toMermaid(definition: WorkflowDefinition): string {
  const lines: string[] = ["stateDiagram-v2"];

  if (definition.nodes) {
    for (const node of definition.nodes) {
      for (const flow of node.outgoing) {
        lines.push(`    ${flow.source} --> ${flow.target}`);
      }
    }
    return lines.join("\n");
  }

  for (const [id, step] of Object.entries(definition.steps)) {
    if (step.next) {
      lines.push(`    ${id} --> ${step.next}`);
    } else {
      lines.push(`    ${id} --> [*]`);
    }
  }

  return lines.join("\n");
}

export function toDot(definition: WorkflowDefinition): string {
  const lines: string[] = ["digraph {", "  rankdir=LR;"];

  if (definition.nodes) {
    for (const node of definition.nodes) {
      if (node.type === "StartEvent") {
        lines.push(`  "${node.id}" [shape=ellipse, style=filled, fillcolor=lightgreen];`);
      } else if (node.type === "EndEvent") {
        lines.push(`  "${node.id}" [shape=ellipse, style=filled, fillcolor=lightcoral];`);
      } else {
        lines.push(`  "${node.id}" [shape=box];`);
      }
      for (const flow of node.outgoing) {
        lines.push(`  "${flow.source}" -> "${flow.target}";`);
      }
    }
  } else {
    for (const [id, step] of Object.entries(definition.steps)) {
      if (step.type === "start") {
        lines.push(`  "${id}" [shape=ellipse, style=filled, fillcolor=lightgreen];`);
      } else if (step.type === "end") {
        lines.push(`  "${id}" [shape=ellipse, style=filled, fillcolor=lightcoral];`);
      } else {
        lines.push(`  "${id}" [shape=box];`);
      }
      if (step.next) {
        lines.push(`  "${id}" -> "${step.next}";`);
      }
    }
  }

  lines.push("}");
  return lines.join("\n");
}
