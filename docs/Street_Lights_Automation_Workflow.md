# Street Lights Automation Workflow

## Overview

This workflow automates the operation of public street lights based on
predefined daily events. Unlike a sensor-based system, the workflow does
**not** measure ambient light. Instead, it reacts to two scheduled
events:

-   **SUNSET** → Turn the street lights **ON**
-   **SUNRISE** → Turn the street lights **OFF**

The workflow is fully automatic and requires no human intervention after
it has been started.

## Objective

Ensure that street lights are switched on every evening and switched off
every morning according to a predefined schedule.

## Workflow Diagram

``` text
                Start
                   │
                   ▼
        Wait for SUNSET Event
                   │
                   ▼
        Turn Street Lights ON
                   │
                   ▼
       Wait for SUNRISE Event
                   │
                   ▼
       Turn Street Lights OFF
                   │
                   └───────────────┐
                                   │
                                   ▼
                     Wait for SUNSET Event
```

The workflow never terminates. It continuously repeats this cycle every
day.

## Workflow States

### 1. Wait for SUNSET

-   Waits for the `SUNSET` event.
-   No action is executed.
-   Next state: **Turn Street Lights ON**

### 2. Turn Street Lights ON

Action:

``` text
turnStreetLightsOn()
```

Next state: **Wait for SUNRISE**

### 3. Wait for SUNRISE

-   Waits for the `SUNRISE` event.
-   No processing occurs.
-   Next state: **Turn Street Lights OFF**

### 4. Turn Street Lights OFF

Action:

``` text
turnStreetLightsOff()
```

Next state: **Wait for SUNSET**

## Events

  Event     Description
  --------- -------------------------------
  SUNSET    Night begins; turn lights ON.
  SUNRISE   Day begins; turn lights OFF.

## Execution Example

### 19:30

    Event: SUNSET

    Wait for SUNSET
            │
            ▼
    Turn Street Lights ON
            │
            ▼
    Wait for SUNRISE

### 06:10

    Event: SUNRISE

    Wait for SUNRISE
            │
            ▼
    Turn Street Lights OFF
            │
            ▼
    Wait for SUNSET

## Characteristics

-   Fully automatic
-   Event-driven
-   Long-running process
-   Cyclic workflow
-   No human intervention
-   Snapshot persistence supported

## Integration with the Workflow Engine

1.  Create an XState actor.
2.  Wait for `SUNSET` or `SUNRISE`.
3.  Execute the corresponding action.
4.  Save the XState snapshot.
5.  Return to the waiting state.
