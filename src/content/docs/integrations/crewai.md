---
title: CrewAI Integration
description: Add synpareia trust primitives to a CrewAI Crew via the Trust Toolkit MCP.
---

import { Aside } from '@astrojs/starlight/components';

CrewAI agents can use synpareia today. The integration path is the standard MCP route — `crewai-tools[mcp]`'s `MCPServerAdapter` wired to the Trust Toolkit MCP server. No bespoke `synpareia-crewai` package required.

<Aside type="note">
This page describes the supported integration as of synpareia-trust-mcp 0.5.0. A higher-level CrewAI wrapper may ship later, but the MCPServerAdapter route is stable and covers every Trust Toolkit tool.
</Aside>

## What you get

Plug the Trust Toolkit into your Crew and any agent in it can:

- **Sign claims** — `make_claim` / `verify_claim`: signed, third-party-verifiable assertions about its work
- **Record interactions** — `recording_start` / `recording_append` / `recording_end` / `recording_proof`: build a tamper-evident chain of an agent's actions, exportable as JSON
- **Prove independence** — `prove_independence`: two-party commit-reveal so two agents' assessments can be shown to be independent (no anchoring bias)
- **Remember counterparties** — `remember_counterparty` / `recall_counterparty` / `add_evaluation`: private notes about other agents
- **Evaluate counterparties** — `evaluate_agent`: aggregate trust signals from configured providers
- **Witness seals** — `witness_seal_timestamp`: third-party timestamp seals on hashes (no content leaves your infra)

Full tool list: [Trust Toolkit MCP →](/integrations/trust-toolkit/)

## Install

```bash
pip install crewai 'crewai-tools[mcp]' synpareia-trust-mcp
```

`synpareia-trust-mcp` runs as a stdio MCP process; `crewai-tools[mcp]` provides the `MCPServerAdapter` that exposes the server's tools to a CrewAI agent.

## Wire it up

```python
from crewai import Agent, Task, Crew
from crewai_tools import MCPServerAdapter
from mcp import StdioServerParameters

# Start the Trust Toolkit MCP server as a subprocess.
trust_mcp = StdioServerParameters(command="synpareia-trust-mcp")

with MCPServerAdapter(trust_mcp) as trust_tools:
    researcher = Agent(
        role="Researcher",
        goal="Produce a verifiable research summary",
        backstory="A researcher who signs everything they conclude.",
        tools=trust_tools,  # Every Trust Toolkit tool is now available
    )

    reviewer = Agent(
        role="Reviewer",
        goal="Independently assess the research and sign the review",
        backstory="A reviewer who never sees the researcher's notes.",
        tools=trust_tools,
    )

    research_task = Task(
        description=(
            "Research <topic>. When you're done, call make_claim with the "
            "summary as content (prefix it with 'research_summary: ' if you "
            "want to label the claim type yourself — make_claim only takes "
            "content + an optional witness flag). Return the signed claim "
            "envelope."
        ),
        expected_output="A signed claim envelope (JSON) from make_claim.",
        agent=researcher,
    )

    review_task = Task(
        description=(
            "Read the researcher's signed claim. "
            "Verify it with verify_claim. "
            "Then prove_independence with the researcher: each side seals "
            "its assessment before either reveals."
        ),
        expected_output="A verified claim plus an independence proof.",
        agent=reviewer,
    )

    crew = Crew(agents=[researcher, reviewer], tasks=[research_task, review_task])
    result = crew.kickoff()
```

The crew agents now have direct access to synpareia's signing, chains, witness seals, and counterparty evaluation. Any block they produce or claim they sign is a portable, third-party-verifiable artefact.

## Configuration

Synpareia tools that hit the network or external services need environment variables. Local-only tools (signing, chains, counterparty memory, commit-reveal) work with no configuration.

```bash
# Optional — only needed if you want network/witness features
export SYNPAREIA_WITNESS_URL=https://witness.synpareia.com
export SYNPAREIA_NETWORK_URL=https://api.synpareia.com   # network not yet live
```

See the [Trust Toolkit configuration table](/integrations/trust-toolkit/#configuration) for the full list. Network-backed tools degrade gracefully when their env var is missing — they surface the missing dependency in a structured field (the exact shape varies by tool: some return an `error`, some a `provider_status`, some a `hint`) and point at the variable to set. Your crew agents can read that and decide whether to fall back to local-only tools or surface the gap to the user.

## Where next?

- [Trust Toolkit MCP →](/integrations/trust-toolkit/) — full tool reference (32 tools across 8 capability areas)
- [Concepts overview →](/concepts/overview/) — what blocks, chains, anchors, and seals actually are
- [Quickstart with the SDK →](/getting-started/) — direct primitive access if you want to bypass the MCP layer
