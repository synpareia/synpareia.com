---
title: Cross-Chain References
description: Using anchors to create verifiable links between independent chains.
---

Anchors connect independent chains. This guide covers the patterns for using them effectively.

## The basic pattern

Agent A wants to prove it saw a specific block in Agent B's chain:

```python
import synpareia
from synpareia import templates
from synpareia.anchor.verify import verify_anchor

# Both agents have their own chains
alice = synpareia.generate()
bob = synpareia.generate()

alice_cop = synpareia.create_chain(alice, policy=templates.cop(alice))
bob_cop = synpareia.create_chain(bob, policy=templates.cop(bob))

# Bob publishes a finding
finding = synpareia.create_block(bob, "message", "Anomaly detected in sector 7")
bob_pos = bob_cop.append(finding)

# Alice anchors to Bob's finding — cryptographic proof she saw it
anchor, pos = synpareia.create_anchor_block(
    alice, alice_cop,
    target_chain_id=bob_cop.id,
    target_sequence=bob_pos.sequence,
    target_block_hash=finding.content_hash,
)

# Anyone can verify this anchor
valid, error = verify_anchor(anchor, bob_cop)
assert valid
```

## Correspondence pattern

Two agents exchange messages and anchor to each other's blocks, creating a verifiable record of their interaction:

```python
from synpareia.anchor.traversal import trace_correspondence

# After a conversation where both agents anchored to each other
pairs = trace_correspondence(alice_cop, bob_cop)

for alice_pos, bob_pos in pairs:
    print(f"Alice saw Bob's block #{bob_pos.sequence}")
```

## Bridge pattern

An agent's CoP links to a shared sphere chain, proving participation:

```python
from synpareia.types import AnchorType

# A sphere is two-party by policy — `templates.sphere` names both signatories,
# and the chain's type follows from the policy rather than a separate argument.
sphere = synpareia.create_chain(alice, policy=templates.sphere(alice, bob))

# After contributing to the sphere
anchor, pos = synpareia.create_anchor_block(
    alice, alice_cop,
    target_chain_id=sphere.id,
    target_sequence=sphere.length,
    target_block_hash=sphere.head.position_hash,
    anchor_type=AnchorType.BRIDGE,
)
```

## Verification without the target chain

If you have the anchor block and the target block but not the full target chain, you can still verify:

```python
from synpareia.anchor.verify import verify_anchor_from_block

valid, error = verify_anchor_from_block(
    anchor_block=anchor,
    target_block=finding,
    target_sequence=bob_pos.sequence,
)
```

This is useful when verifying exported data where you might not have the full chain available.
