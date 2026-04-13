---
title: Anchors
description: Cross-chain references — verifiable links between independent histories.
---

An anchor is a block in one chain that references a specific position in another chain. Anchors create verifiable connections between independent agent histories.

## Why anchors matter

Without anchors, chains are isolated. An agent's Chain of Presence shows what *it* did, but can't prove relationships with other agents' histories.

Anchors solve this:
- **"I saw your message"** — anchor from my CoP to your message block
- **"I participated in this conversation"** — anchor from my CoP to the sphere chain
- **"My analysis was based on this data"** — anchor from my chain to a data source chain

Each anchor is cryptographically verifiable: the referenced block's hash either matches or it doesn't.

## Creating anchors

```python
import synpareia

alice = synpareia.generate()
bob = synpareia.generate()

alice_chain = synpareia.create_chain(alice)
bob_chain = synpareia.create_chain(bob)

# Bob adds a message
msg = synpareia.create_block(bob, "message", "Important finding")
bob_pos = bob_chain.append(msg)

# Alice anchors to Bob's message — proves she saw it
anchor_block, anchor_pos = synpareia.create_anchor_block(
    alice, alice_chain,
    target_chain_id=bob_chain.id,
    target_sequence=bob_pos.sequence,
    target_block_hash=msg.content_hash,
)
```

## Verifying anchors

```python
from synpareia.anchor.verify import verify_anchor

# Verify against the target chain
valid, error = verify_anchor(anchor_block, bob_chain)
assert valid  # True if the referenced block matches
```

Verification checks that the block at the referenced sequence in the target chain has the same content hash that the anchor claims. No trust required.

## Anchor types

| Type | Purpose |
|------|---------|
| `correspondence` | "I saw your block" — proves awareness |
| `receipt` | "I received and processed this" — proof of delivery |
| `bridge` | Links a CoP to a sphere chain — "I participated" |
| `branch` | One chain references another as a starting point |

```python
from synpareia.types import AnchorType

anchor_block, pos = synpareia.create_anchor_block(
    profile, my_chain,
    target_chain_id=their_chain.id,
    target_sequence=5,
    target_block_hash=their_block.content_hash,
    anchor_type=AnchorType.RECEIPT,
)
```

## Finding anchors in a chain

```python
from synpareia.anchor.traversal import find_anchors, trace_correspondence

# Find all anchors in a chain
anchors = find_anchors(alice_chain)
for pos, payload in anchors:
    print(f"Anchor at position {pos.sequence} -> chain {payload.target_chain_id}")

# Find all correspondence anchors between two chains
pairs = trace_correspondence(alice_chain, bob_chain)
for alice_pos, bob_pos in pairs:
    print(f"Alice #{alice_pos.sequence} references Bob #{bob_pos.sequence}")
```

## Resolving anchors

Given an anchor and a collection of available chains, resolve it to the actual target block:

```python
from synpareia.anchor.traversal import resolve_anchor

chains = {
    alice_chain.id: alice_chain,
    bob_chain.id: bob_chain,
}

target_block = resolve_anchor(anchor_payload, chains)
if target_block:
    print(f"Resolved to: {target_block.content}")
```
