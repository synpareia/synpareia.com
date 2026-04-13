---
title: CrewAI Integration
description: Tamper-evident execution logs for CrewAI crews.
---

:::note
The `synpareia-crewai` package is coming soon. This page describes the planned integration.
:::

## Overview

`synpareia-crewai` adds tamper-evident logging to CrewAI crew executions. Every agent action — task assignment, tool use, message, result — becomes a cryptographically signed block in a verifiable chain.

## Planned usage

```python
from crewai import Agent, Task, Crew
from synpareia_crewai import attest

@attest
class MyResearchCrew(Crew):
    agents = [researcher, analyst, writer]
    tasks = [research_task, analysis_task, writing_task]

# Run normally — synpareia records everything
result = MyResearchCrew().kickoff()

# Get the attestation report
report = result.attestation
print(f"{report.agent_count} agents, {report.block_count} actions")
print(f"Chain verified: {report.verified}")

# Export as portable proof
report.export("crew_execution_report.json")
```

## What gets recorded

- **CoP per agent** — each agent in the crew gets its own Chain of Presence
- **Sphere chain per execution** — the crew run itself is a shared chain
- **Anchors** — each agent's CoP links to the sphere chain
- **Tool calls, messages, results** — all become signed blocks

## Value proposition

Without synpareia: you get logs. With synpareia: you get a cryptographically verifiable execution report. Every action is signed, hash-linked, and independently verifiable. You can prove exactly what happened, when, and by whom.
