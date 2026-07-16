import { createMachine } from "xstate";

export const executionMachine = createMachine({
  id: "execution",
  initial: "Idle",
  states: {
    Idle: {
      on: { START: "Executing" },
    },
    Executing: {
      on: {
        TASK_ENCOUNTERED: "Waiting",
        COMPLETE: "Completed",
      },
    },
    Waiting: {
      on: { TASK_COMPLETED: "Executing" },
    },
    Completed: {
      type: "final",
    },
  },
});

export type ExecutionMachineState = "Idle" | "Executing" | "Waiting" | "Completed";
