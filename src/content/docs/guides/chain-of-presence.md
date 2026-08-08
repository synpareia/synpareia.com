---
title: Building a Chain of Presence
description: A complete walkthrough of building and using a Chain of Presence.
---

A Chain of Presence (CoP) is an agent's personal history — a tamper-evident record of everything it has done across all contexts. This guide walks through building one from scratch.

## Setup

```python
import synpareia
from synpareia import templates

# Create an identity for your agent
profile = synpareia.generate()

# Start a Chain of Presence. The policy is the chain's genesis block: it fixes
# who may append and what counts as a valid entry, before anything is written.
#
# The default template does not permit a `tool_call` type, so declare it up front —
# a block type the policy does not name is refused at append, by design.
#
# EXTEND the default rather than replacing it. Passing a bare tuple silently drops
# every type you did not re-list, including `commitment` and `anchor`, and the loss
# only surfaces later at the append that needs one.
default_types = templates.cop(profile).block_types_permitted
cop = synpareia.create_chain(
    profile,
    policy=templates.cop(
        profile,
        block_types_permitted=(*default_types, "tool_call"),
    ),
)
```

## Recording agent activity

Every meaningful action becomes a block in the chain:

```python
# Agent sends a message
msg = synpareia.create_block(profile, "message", "Starting analysis of dataset X")
cop.append(msg)

# Agent makes a decision
decision = synpareia.create_block(
    profile, "thought",
    "Dataset shows anomaly in sector 7. Recommending deeper investigation.",
    metadata={"confidence": 0.87}
)
cop.append(decision)

# Agent calls a tool
tool_call = synpareia.create_block(
    profile, "tool_call",
    '{"tool": "search", "query": "sector 7 historical data"}',
)
cop.append(tool_call)
```

## What to record

The CoP should capture actions that matter for accountability and verifiability:

| Action | Block type | Why record it |
|--------|-----------|---------------|
| Messages sent | `message` | Proves what was communicated |
| Reasoning steps | `thought` | Audit trail for decisions |
| Tool calls | Custom type | Proves what tools were used and when |
| Data received | `message` or custom | Proves what information was available |
| Commitments made | `commitment` | Proves independent evaluation (commit-reveal) |
| Interactions with other agents | `anchor` | Links to shared conversation histories |

You don't need to record everything. Focus on actions that someone might later want to verify.

## Persistent storage

For agents that run across multiple sessions, use SQLite storage:

```python
from synpareia.chain.storage.sqlite import SQLiteStore

store = SQLiteStore("my_agent_cop.db")
cop = synpareia.create_chain(profile, policy=templates.cop(profile), store=store)

# Blocks persist across process restarts
```

## Verification

At any point, verify the chain's integrity:

```python
valid, errors = cop.verify(public_keys={profile.id: profile.public_key})
if valid:
    print(f"Chain intact: {cop.length} blocks verified")
else:
    for error in errors:
        print(f"Problem: {error}")
```

## Exporting for audit

Export the chain for independent verification:

```python
# Full export — includes all content
export = synpareia.export_chain(cop)

# Privacy-preserving export — includes hashes but not content
export = synpareia.export_chain(cop, include_content=False)
```

The exported JSON is self-contained. A verifier doesn't need access to synpareia or any external service:

```python
# Anyone can do this — but they need the author's public key to check signatures.
# Publish it alongside the export, or fetch it from the author's profile.
valid, errors = synpareia.verify_export(
    export, public_keys={profile.id: profile.public_key}
)
```

## Linking to conversations

When your agent participates in a multi-agent interaction, anchor your CoP to the shared sphere chain:

```python
# The shared chain the conversation ran on. A sphere is co-owned, so its policy
# names both parties.
counterparty = synpareia.generate()
conversation_sphere = synpareia.create_chain(
    profile, policy=templates.sphere(profile, counterparty)
)
conversation_sphere.append(
    synpareia.create_block(profile, "message", "…the conversation…")
)

# After participating, anchor your CoP to where the conversation had got to
anchor, pos = synpareia.create_anchor_block(
    profile, cop,
    target_chain_id=conversation_sphere.id,
    target_sequence=conversation_sphere.length,
    target_block_hash=conversation_sphere.head.position_hash,
    anchor_type="bridge",
)
```

This creates a verifiable link: "my agent participated in this conversation, and at this point the conversation's state was X."
