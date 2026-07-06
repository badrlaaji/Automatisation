## Project Objective

The goal of this project is to build a simple **Workflow Engine** in **TypeScript** capable of executing workflows described in JSON files, with persistent state and the ability to **resume execution after a crash or restart**.

The first supported workflow (EX1) is:

```
Start
   ↓
Create Account
   ↓
Send Welcome Email
   ↓
End
```

At this stage, the engine focuses only on **workflow execution**, without implementing the actual business logic (steps are logged, not really performed — no real user creation, no real email sending yet).

---

## 2. Project Architecture

```
src/
├── engine/
│   ├── WorkflowEngine.ts
│   └── WorkflowEngine.test.ts
│
├── entities/
│   ├── Workflow.ts
│   ├── ProcessInstance.ts
│   └── Token.ts
│
├── repositories/
│   ├── WorkflowRepository.ts
│   ├── WorkflowRepository.test.ts
│   ├── ProcessRepository.ts
│   └── TokenRepository.ts
│
├── database/
│   └── database.ts
│
├── test/
│   ├── setup.ts       (resets test DB before each test)
│   └── helpers.ts      (shared test fixtures: createEngine, createLinearWorkflow, ex1Path)
│
├── workflows/
│   └── EX1.json
│
├── index.ts    (public exports, for using this project as a library)
└── main.ts     (entry point, runs demo scenarios)

prisma/
└── schema.prisma   (SQLite schema, source of truth for the database)
```

Storage is implemented with **Prisma + SQLite** (a local `.db` file, configured via `DATABASE_URL` in `.env`), not a generic/abstract database.

---

## Core Concepts

### Workflow

A workflow is the definition of a business process. It's loaded once from a JSON file, then persisted in the `workflows` table (as a serialized JSON string) so it can be reloaded without the original file.

Example:

```text
start
   ↓
register
   ↓
send_email
   ↓
end
```

The workflow describes **what to execute**, not **how to execute it**. Each step has a `type` (`start`, `task`, or `end`) and an optional `next` (the id of the following step — absent only on `end` steps).

The workflow describes **what to execute**, not **how to execute it**.

---

### Process Instance

A process instance represents one execution of a workflow. Its status is one of two values:

* `RUNNING` — currently in progress (default on creation)
* `COMPLETED` — reached the `end` step

Example:

```
Workflow: user_registration
Instance: #1
Status: RUNNING
```

A process that is already `COMPLETED` will not be re-executed even if `executeProcess` is called on it again.

---

### Token

A token represents the current position of the workflow execution.

Example:

```
Current step:
send_email
```

The token moves from one step to another until the process reaches the end event. **The token's position is saved to the database after every single step** — this is what makes crash recovery possible: even if the process stops unexpectedly between two steps, the last known position is never lost.

---

## Workflow Engine Responsibilities

The Workflow Engine is responsible for:

* loading workflow definitions (from a JSON file, or from the database once saved);
* building the execution graph (an in-memory `Map` of steps, for fast lookup);
* creating process instances;
* creating execution tokens;
* executing workflow steps;
* moving tokens, and persisting their new position after every step;
* marking a process `COMPLETED` when it reaches the `end` step;
* refusing to re-execute a process that is already `COMPLETED`;
* optionally pausing execution after a fixed number of steps (`maxSteps`), to simulate a crash;
* **resuming all processes still marked `RUNNING`** after an application restart (`resumeAllRunning`), continuing each one from its last persisted token position.

---

## 5. Execution Flow

### Normal (uninterrupted) run

```
Load EX1.json (first time only — seeds the workflow into the database)
        ↓
Build workflow graph
        ↓
Create process instance (status: RUNNING)
        ↓
Create token (positioned at "start")
        ↓
Find current step in the graph
        ↓
Execute step (log only, for now)
        ↓
Is step type "end"?
   ├─ yes → mark process COMPLETED, stop
   └─ no  → move token to step.next, save token, repeat
```

### Crash & resume run

```
Start process → execute N steps → (simulated crash, process stays RUNNING in DB)
        ↓
--- Application restart ---
        ↓
resumeAllRunning()
        ↓
Find all ProcessInstance rows with status = RUNNING
        ↓
For each one: reload its workflow + its last saved token
        ↓
Continue the execution loop from that exact token position
        ↓
Repeat until END
```

---

## Database Tables

Implemented as a SQLite database via Prisma (`prisma/schema.prisma`).

### workflows

Stores workflow definitions.

```
id           string, primary key
name         string
definition   string (the workflow's steps, serialized as JSON text)
```

### process_instances

Stores workflow executions.

```
id           integer, primary key, auto-increment
workflow_id  string (foreign key → workflows.id)
status       string ("RUNNING" | "COMPLETED")
```

### tokens

Stores execution positions.

```
id            integer, primary key, auto-increment
process_id    integer (foreign key → process_instances.id)
current_step  string (id of the step the token currently sits on)
```

---

## Testing

Tests are written with **Vitest** and run against a dedicated SQLite test database (`data/test.db`, separate from the dev database), reset before every test to avoid state leaking between tests. File-level parallelism is disabled, since all test files share the same physical database file.

Covered by tests: loading a workflow from a JSON file, saving/reloading a workflow, starting a process, running it to completion, pausing after N steps, refusing to re-execute a completed process, and resuming a paused process to completion via `resumeAllRunning`.

---

## Running the project

```
npm run dev          — run the full demo workflow once, start to finish
npm run dev:crash    — simulate a crash after 2 steps, then resume and finish
npm run dev:resume   — resume all processes currently marked RUNNING
npm run test         — run the test suite
npm run db:push      — sync the Prisma schema to the SQLite database
```
