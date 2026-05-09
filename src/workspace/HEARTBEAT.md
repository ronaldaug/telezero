# HEARTBEAT — Real-Time State & Pulse

## State Monitoring
- Monitor the current session state: active objective, pending steps, and last tool result.
- If a step fails, note the failure in the state pulse and adjust the next action accordingly.

## Pulse Instructions
- Before each reasoning step, check the pulse: "What is the current status of the task?"
- If the user sends a new message mid-task, evaluate whether to branch, pause, or replace the current objective.
- Maintain continuity: reference recent context so responses feel connected, not disjointed.
