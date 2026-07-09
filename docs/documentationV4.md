## Project Objective

The goal of this project is to build a **Workflow Engine** in **TypeScript** capable of executing workflows described in JSON files, with persistent state and the ability to **resume execution after a crash or restart**.

The execution core is now driven by **XState v5** instead of a hand-written loop: each process instance is backed by its own XState actor, generated dynamically from the workflow's JSON definition.

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
│   ├── WorkflowEngine.ts        (orchestrates workflows, delegates execution to XState actors)
│   ├── machineFactory.ts        (buildMachine(definition) — generates an XState machine config from JSON)
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

`scripts/xstate-inspect.ts` (visualization-only script generating Mermaid diagrams) is no longer a separate, disconnected experiment — the machine-generation logic it prototyped now lives in `machineFactory.ts` and is used by the real engine.

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

`buildMachine(definition)` converts this JSON definition into a generic XState machine config (one state per step, `NEXT` transitions, `end` steps marked `type: "final"`). This function is fully generic — it works for any `WorkflowDefinition`, not just EX1.

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

**Each `ProcessInstance` owns its own XState actor** (`createActor(machine)`). Actors are never shared or global — this is what allows several instances of the same workflow (or of different workflows) to run in parallel, each advancing independently.

---

### Token

A token represents the current position of the workflow execution, backed by the actor's persisted state.

Example:

```
Current step:
send_email
```

The token moves from one step to another until the process reaches the end event. **The actor's state is persisted to the database after every single transition** via `actor.getPersistedSnapshot()` — this is what makes crash recovery possible: even if the process stops unexpectedly between two steps, the last known position is never lost.

On resume, the actor is recreated with `createActor(machine, { snapshot })`, restoring execution exactly where it left off rather than restarting from `start`.

---

## Workflow Engine Responsibilities

The Workflow Engine is responsible for:

* loading workflow definitions (from a JSON file, or from the database once saved);
* building a generic XState machine from the definition (`buildMachine`), for fast, declarative execution;
* creating process instances;
* creating one XState actor per process instance, and its execution token;
* executing workflow steps via the actor's transitions;
* persisting the actor's snapshot after every step;
* marking a process `COMPLETED` when its actor reaches the `end` (final) state;
* refusing to re-execute a process that is already `COMPLETED`;
* optionally pausing execution after a fixed number of steps (`maxSteps`), to simulate a crash;
* **resuming all processes still marked `RUNNING`** after an application restart (`resumeAllRunning`), by recreating each actor from its last persisted snapshot;
* supporting multiple process instances — of the same or different workflows — running independently and in parallel.

---

## 5. Execution Flow

### Normal (uninterrupted) run

```
Load EX1.json (first time only — seeds the workflow into the database)
        ↓
Build XState machine from definition (buildMachine)
        ↓
Create process instance (status: RUNNING)
        ↓
Create actor for this instance (createActor(machine).start())
        ↓
Actor sits at "start" — create token reflecting its position
        ↓
Send NEXT → actor transitions → persist snapshot → update token
        ↓
Is actor's current state final ("end")?
   ├─ yes → mark process COMPLETED, stop
   └─ no  → repeat (send NEXT, persist, update token)
```

### Crash & resume run

```
Start process → create actor → advance N steps → persist snapshot at each step
        ↓
(simulated crash, process stays RUNNING in DB, last snapshot preserved)
        ↓
--- Application restart ---
        ↓
resumeAllRunning()
        ↓
Find all ProcessInstance rows with status = RUNNING
        ↓
For each one: reload its workflow, rebuild its machine, recreate its actor
             from the last persisted snapshot (createActor(machine, { snapshot }))
        ↓
Continue the execution loop from that exact actor state
        ↓
Repeat until the actor reaches a final state
```

### Parallel instances

```
Workflow "user_registration" loaded once → one machine definition
        ↓
Process #1 → own actor A (snapshot persisted under process #1's token)
Process #2 → own actor B (snapshot persisted under process #2's token)
        ↓
Advancing A never affects B — each actor/process is fully isolated
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

Stores execution positions, now backed by the actor's persisted snapshot rather than a bare string.

```
id            integer, primary key, auto-increment
process_id    integer (foreign key → process_instances.id)
current_step  string (id of the step the token currently sits on — kept for quick reads/debugging)
snapshot      string (the actor's persisted XState snapshot, serialized as JSON — source of truth for resume)
```

---

## Testing

Tests are written with **Vitest** and run against a dedicated SQLite test database (`data/test.db`, separate from the dev database), reset before every test to avoid state leaking between tests. File-level parallelism is disabled, since all test files share the same physical database file.

Covered by tests: loading a workflow from a JSON file, saving/reloading a workflow, starting a process, running it to completion, pausing after N steps, refusing to re-execute a completed process, resuming a paused process to completion via `resumeAllRunning`, **and running two process instances of the same workflow in parallel to confirm they advance independently** (isolation of per-process XState actors).

---

## Running the project

```
npm run dev          — run the full demo workflow once, start to finish
npm run dev:crash    — simulate a crash after 2 steps, then resume and finish
npm run dev:resume   — resume all processes currently marked RUNNING
npm run test         — run the test suite
npm run db:push      — sync the Prisma schema to the SQLite database
```
