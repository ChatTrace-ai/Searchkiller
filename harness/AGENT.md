# harness/ — Generic Feedback Loop Framework

## Role
Application-agnostic harness for iterative quality feedback loops.
Operates through interfaces (IJudge, IReportGenerator) — zero coupling to any specific application.

## Contents
| File | Description |
|------|-------------|
| types.ts | Core interfaces: IJudge, IReportGenerator, JudgeResult, GenerationResult |
| handoff.ts | Structured Handoff Protocol — typed document with file-based store |
| sprint-contract.ts | Sprint Contract — negotiated acceptance criteria with 4-dim scoring |
| feedback-loop.ts | Feedback Loop Engine — iterative HITL loop via injected interfaces |
| index.ts | Barrel export |

## Boundaries
- reads: .agents/handoffs/, .agents/contracts/, .agents/loops/
- writes: .agents/handoffs/, .agents/contracts/, .agents/loops/
- imports_from: NOTHING external — fully self-contained
- NEVER imports from: app/, components/, lib/, agents/

## Permission Level
L0-harness: generic framework; provides interfaces for L1 (agents) to implement

## Import Hierarchy
```
harness/ (L0)  ← generic, zero dependencies
  ↑ implements
agents/ (L1)   ← application-specific, implements harness interfaces
  ↑ adapts
lib/ (L3)      ← shared utilities (gemini, exa, schemas)
  ↑ uses
app/ (L2)      ← routes & pages, uses lib/ for adapters
```
