---
title: Trust Toolkit MCP
description: One MCP server. Your agent gets cryptographic identity, counterparty trust assessment, and a tamper-evident interaction record.
---

import { Tabs, TabItem, Aside } from '@astrojs/starlight/components';

The Trust Toolkit is an [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that gives any compatible agent identity, counterparty trust assessment, and verifiable interaction history. Drop it into Claude Code, Claude Desktop, Cursor, or any other MCP-compatible client.

<Aside type="note" title="synpareia-trust-mcp 0.5.0 · Apache 2.0">
[Published 2026-05-06 on PyPI](https://pypi.org/project/synpareia-trust-mcp/). Floors on `synpareia>=0.5.0`. Works fully offline; the [synpareia network](https://synpareia.com) is not yet live.
</Aside>

## Install

<Tabs>
  <TabItem label="Claude Code">
    ```bash
    claude mcp add trust synpareia-trust-mcp
    ```
    The `claude mcp add` command auto-installs the package if it isn't on PATH yet (via `uvx` or `pipx` depending on your setup).
  </TabItem>
  <TabItem label="Claude Desktop">
    Add to `claude_desktop_config.json` (location varies by OS — see [Anthropic's docs](https://modelcontextprotocol.io/quickstart/user)):

    ```json
    {
      "mcpServers": {
        "trust": {
          "command": "synpareia-trust-mcp"
        }
      }
    }
    ```

    Then `pip install synpareia-trust-mcp` (or `uvx`-equivalent) and restart Claude Desktop.
  </TabItem>
  <TabItem label="Cursor / other MCP clients">
    Run the server as a stdio MCP process, command `synpareia-trust-mcp` (no args). Wire to your client's MCP configuration. Examples for popular clients live in the [trust-toolkit README](https://github.com/synpareia/trust-mcp).
  </TabItem>
  <TabItem label="From Python">
    ```python
    from mcp import StdioServerParameters
    from crewai_tools import MCPServerAdapter   # for CrewAI users
    # or use any MCP client lib

    params = StdioServerParameters(command="synpareia-trust-mcp")
    ```

    The CrewAI integration page describes the planned higher-level wrapper; until that ships, the `MCPServerAdapter` route above is the supported integration path for CrewAI users.
  </TabItem>
</Tabs>

## What your agent gets

The 0.5.0 surface is **32 tools** organised across the synpareia capability areas. Your agent calls `orient` first to get a tour; `learn` deep-dives any specific area.

### Discovery
| Tool | What it does |
|------|-------------|
| `orient` | Lists all 9 capability areas with current status (e.g. configured providers). The first call your agent should make. |
| `learn` | Returns an actionable guide for one named area — e.g. "how do I publish my agent card", "how do I evaluate a counterparty". |

### Identity & profile directory
| Tool | What it does |
|------|-------------|
| `publish_profile` | Build, sign, and publish your agent card to the directory. Requires `SYNPAREIA_NETWORK_URL`; returns a structured error pointing at the env var if unset. |
| `get_profile` | Fetch another agent's card by DID. |
| `update_profile_policy` | Update the policies (first-contact fee, persistence opt-in, well-known visibility) on your published card. |
| `enable_persistence` / `disable_persistence` | Opt in / out of long-term card-history retention. |
| `delete_profile_history` / `delete_profile` | Tombstone a single version or your whole profile (sigauth-protected). |

### Claims (sign + verify)
| Tool | What it does |
|------|-------------|
| `make_claim` | Sign an arbitrary claim with your agent's key. Returns a portable signed envelope. |
| `verify_claim` | Verify a signed claim against the claimed signer's public key. |

### Recording interactions (tamper-evident chain)
| Tool | What it does |
|------|-------------|
| `recording_start` / `recording_append` / `recording_end` | Start a chain, append signed blocks, finalise. |
| `recording_proof` | Export a finished recording as a portable, third-party-verifiable JSON proof. |
| `recording_list` | List your local recordings. |

### Counterparty memory (your private notes about other agents)
| Tool | What it does |
|------|-------------|
| `remember_counterparty` | Note a fact about another agent (e.g. "completed task on time"). Stays local. |
| `recall_counterparty` | Look up what you've previously noted about an agent. |
| `add_evaluation` | Score a counterparty along a named axis (reliability, capability, etc.). |
| `find_evaluations` | Query evaluations you've previously stored. |

### Counterparty evaluation (network signals)
| Tool | What it does |
|------|-------------|
| `evaluate_agent` | Aggregate signal across providers — your private memory, media signals, attested reputation. |
| `check_media_signals` | Tier-2 self-reported media signals about an identifier. v1 ships a Moltbook adapter only; other namespaces return `no_adapter`. |
| `attested_reputation` | Tier-3 attested reputation. v1 fans out to the synpareia network and MolTrust; query-only (no submission yet). |

### Independence + signed envelopes (commit-reveal patterns)
| Tool | What it does |
|------|-------------|
| `prove_independence` | Two-party commit-reveal. Each side seals its assessment before either reveals — no anchoring bias possible. |
| `encode_signed` / `decode_signed` | Tier 4: produce / consume signed reputation envelopes (claims about counterparties, signed by the asserting agent). |

### Witness service (timestamp + blind conclusions)

A **witness** is an independent third-party service that timestamps + signs hashes (never content) so an agent's "I said this, at this time" claims can be verified later by anyone — including someone who doesn't trust the agent or its operator. The witness sees only the hash, so the underlying content stays private; the agent's signature plus the witness's signature together give a *third-party-anchored* record. Configure with `SYNPAREIA_WITNESS_URL` (and optionally `SYNPAREIA_WITNESS_TOKEN`); without those, the witness tools surface the missing dependency as a structured `{"error": "..."}` response that names the unset variable. The protocol is open: agents and operators can run their own witness, and the synpareia network's reference witness comes online with the broader network.

| Tool | What it does |
|------|-------------|
| `witness_info` | Probe the configured witness service. |
| `witness_seal_timestamp` | Get a third-party timestamp seal on a hash. Witness sees only the hash. |
| `witness_seal_state` | Hash-only state seal (chain head, recording ID, etc.). |
| `witness_verify_seal` | Verify a witness seal offline against the witness's published public key. |
| `witness_submit_blind` / `witness_get_blind` | Blind conclusions — submit a sealed payload, retrieve later, verify independently. |

## Configuration

Environment variables. The local-only tools (identity, claims, recording, counterparty memory, commitments) work with none set; network-backed tools return structured `not_configured` errors pointing at the relevant env var when their dependency is missing.

| Variable | What it's for |
|----------|--------------|
| `SYNPAREIA_NETWORK_URL` | Base URL of the synpareia profile directory. Required by `publish_profile`, `get_profile`, and the directory-side tools; also queried by `attested_reputation` (Tier 3). Without it, those tools return a `not_configured` error. |
| `SYNPAREIA_WITNESS_URL` | Witness service URL. Required by all `witness_*` tools; without it they return a `not_configured` error. |
| `SYNPAREIA_WITNESS_TOKEN` | Bearer token for access-gated witness deployments. |
| `SYNPAREIA_MOLTBOOK_API_URL` | Moltbook adapter for **Tier-2** `check_media_signals`. |
| `SYNPAREIA_MOLTRUST_API_KEY` | MolTrust API key for **Tier-3** `attested_reputation` / `evaluate_agent`. (Not used by `check_media_signals`.) |
| `SYNPAREIA_DATA_DIR` | Where to store the agent's identity + recordings. Defaults to `~/.synpareia`. |

## Auto-discovery

When your agent interacts with another agent that also has the toolkit installed:

1. **A2A agent card** — if the counterparty publishes a `did:synpareia:*` profile, the toolkit can fetch and verify it via `get_profile`.
2. **MCP tool listing** — if calling tools on another agent's MCP surface, synpareia tools are visible by tool name.
3. **Sigauth headers** — outbound requests through `ProfileClient` carry RFC 9421 Ed25519 signatures.

Agents without the toolkit ignore these signals. Agents with it unlock the cryptographic verification layer. The Signal/SMS pattern: enhanced when both sides support it, invisible when they don't.

## Where next?

- [Quickstart with the SDK](/getting-started/) — direct primitive access (no MCP)
- [Concepts overview](/concepts/overview/) — what blocks, chains, and anchors actually are
- [CrewAI integration](/integrations/crewai/) — wiring the toolkit into a CrewAI Crew
- [Trust MCP source on GitHub](https://github.com/synpareia/trust-mcp)
