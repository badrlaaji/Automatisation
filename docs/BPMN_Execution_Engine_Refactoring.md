# BPMN Execution Engine Refactoring

## Overview

The project is being refactored from a **workflow-specific XState
machine generator** into a **generic BPMN execution engine**.

Previously, each workflow was converted into its own XState machine.
While this approach worked for simple linear workflows, it does not
scale well for BPMN concepts such as gateways, timers, parallel
execution, and subprocesses.

The new architecture separates the **workflow definition** from the
**execution engine**, making the project easier to maintain, extend, and
test.

------------------------------------------------------------------------

# Architecture Before Refactoring

``` text
Workflow Definition
        │
        ▼
Generate XState Machine
        │
        ▼
Execute Workflow
```

### Limitations

-   One XState machine is generated for each workflow.
-   Workflow logic is embedded inside the state machine.
-   Difficult to support branching and BPMN gateways.
-   Difficult to support multiple execution paths.
-   Hard to maintain and extend.

------------------------------------------------------------------------

# Architecture After Refactoring

``` text
Workflow Definition
        │
        ▼
Execution Engine
        │
        ▼
Generic XState Machine
        │
        ▼
Process Instance
```

The workflow becomes **data**, while the XState machine becomes the
**runtime responsible for executing that data**.

------------------------------------------------------------------------

# Main Concepts

## WorkflowDefinition

Represents the static definition of a BPMN workflow.

``` text
Start
  ↓
Task
  ↓
End
```

Contains:

-   Workflow ID
-   Nodes
-   Sequence Flows

## Node

Supported node types (Version 1):

-   StartEvent
-   Task
-   EndEvent

Each node contains:

-   `id`
-   `type`
-   `outgoing`

## SequenceFlow

Represents a connection between two nodes.

-   `id`
-   `source`
-   `target`

## ProcessInstance

Represents one execution of a workflow.

Contains:

-   Instance ID
-   Workflow ID
-   Current Node ID
-   Status (`RUNNING`, `WAITING`, `COMPLETED`)

------------------------------------------------------------------------

# Execution Engine

Responsibilities:

-   Execute the current node.
-   Move to the next node.
-   Update the process instance.
-   Detect process completion.

The engine interprets the workflow and understands node types.

------------------------------------------------------------------------

# Generic XState Machine

``` text
Idle
   │
   ▼
Executing
   │
   ├──────────────► Waiting
   │                   │
   │             TASK_COMPLETED
   │                   │
   ▼                   ▼
Completed ◄──────── Executing
```

The machine manages only the execution lifecycle.

------------------------------------------------------------------------

# Execution Rules

## StartEvent

-   Executes immediately.
-   Moves automatically to the next node.

## Task

-   Enters the `WAITING` state.
-   Waits for a `TASK_COMPLETED` event.
-   Continues execution when the event is received.

## EndEvent

-   Marks the process as `COMPLETED`.
-   Stops execution.

------------------------------------------------------------------------

# Supported Workflows

## Workflow 1

``` text
Start
 ↓
End
```

Completes automatically.

## Workflow 2

``` text
Start
 ↓
Task
 ↓
End
```

Execution pauses at the task until `TASK_COMPLETED` is received.

------------------------------------------------------------------------

# Refactoring Goals

-   Separate workflow definition from execution.
-   Keep workflow definitions as pure data.
-   Introduce a generic execution engine.
-   Replace dynamically generated workflow machines with one reusable
    XState machine.
-   Preserve as much existing code as possible.
-   Prepare the architecture for future BPMN features.

------------------------------------------------------------------------

# Future Extensions

-   Exclusive Gateway (XOR)
-   Parallel Gateway (AND)
-   Service Task
-   User Task
-   Timer Events
-   Boundary Events
-   Subprocesses
-   Message Events

------------------------------------------------------------------------

# Summary

  Component                Responsibility
  ------------------------ -----------------------------
  WorkflowDefinition       Static process definition
  Node                     BPMN element
  SequenceFlow             Connection between nodes
  ProcessInstance          Runtime execution state
  Execution Engine         Interprets the workflow
  Generic XState Machine   Manages execution lifecycle

This architecture provides a clean foundation for building a complete
BPMN execution engine.
