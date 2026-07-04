
## Project Objective

The goal of this project is to build a simple **Workflow Engine** in **TypeScript** capable of executing workflows described in JSON files.

The first supported workflow (EX1) is:


Start
   ↓
Create Account
   ↓
Send Welcome Email
   ↓
End
```

At this stage, the engine will focus only on **workflow execution**, without implementing the actual business logic.

---

## 2. Project Architecture


src/

engine/
    WorkflowEngine.ts

entities/
    Workflow.ts
    ProcessInstance.ts
    Token.ts

repositories/
    WorkflowRepository.ts
    ProcessRepository.ts
    TokenRepository.ts

database/
    database.ts

workflows/
    EX1.json

main.ts
```

---

## Core Concepts

### Workflow

A workflow is the definition of a business process.

Example:

```text id="pn4t0f"
start
   ↓
register
   ↓
send_email
   ↓
end
```

The workflow describes **what to execute**, not **how to execute it**.

---

### Process Instance

A process instance represents one execution of a workflow.

Example:


Workflow: user_registration
Instance: #1
Status: RUNNING
```

---

### Token

A token represents the current position of the workflow execution.

Example:

```
Current step:
send_email
```

The token moves from one step to another until the process reaches the end event.

---

##  Workflow Engine Responsibilities

The Workflow Engine is responsible for:

* loading workflow definitions;
* building the execution graph;
* creating process instances;
* creating execution tokens;
* executing workflow steps;
* moving tokens;
* persisting execution state;
* completing the process.

---

## 5. Execution Flow

```
Load EX1.json
        ↓
Build workflow graph
        ↓
Create process instance
        ↓
Create token
        ↓
Find current step
        ↓
Execute step
        ↓
Move token
        ↓
Save token
        ↓
Repeat until END
```

---

## Database Tables

### workflows

Stores workflow definitions.

```text id="7djlwm"
id
name
definition
```

### process_instances

Stores workflow executions.


id
workflow_id
status
```

### tokens

Stores execution positions.

id
process_id
current_step
```

---

