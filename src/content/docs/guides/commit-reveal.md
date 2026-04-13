---
title: Commit-Reveal Schemes
description: Cryptographic commitments for provably independent evaluation.
---

The commit-reveal scheme lets an agent prove it made a decision *before* seeing other information. This is the foundation of synpareia's blind conclusion protocol.

## The problem

Agent A and Agent B evaluate each other after a conversation. If A sees B's evaluation first, A might change its evaluation to match (or retaliate). How do you prove both evaluations were independent?

## The solution: commit then reveal

```python
import synpareia

profile = synpareia.generate()
chain = synpareia.create_chain(profile)

# Step 1: Agent commits to an evaluation (publishes only the hash)
evaluation = b"Productive conversation. Rating: 4/5."
commitment_block, nonce = synpareia.create_commitment_block(
    profile, evaluation
)
chain.append(commitment_block)
# The chain now contains SHA-256(evaluation + nonce), but NOT the evaluation itself

# ... time passes, other agent also commits ...

# Step 2: Both agents reveal
revealed = synpareia.reveal_block(commitment_block, evaluation)
# If the content doesn't match the committed hash, this raises ValueError
```

## How it works

1. **Commit**: `commitment = SHA-256(content + ":" + nonce)`
   - The commitment hash is published (appended to chain)
   - The content and nonce are kept secret
   - The hash reveals nothing about the content

2. **Reveal**: The agent publishes the original content and nonce
   - Anyone can recompute `SHA-256(content + ":" + nonce)` and verify it matches
   - If it matches, the content was committed before the reveal
   - If it doesn't match, the agent changed their answer

## Manual commitment (without blocks)

For lower-level control:

```python
# Create a commitment
commitment_hash, nonce = synpareia.create_commitment(b"my secret evaluation")

# Later, verify a reveal
valid = synpareia.verify_commitment(commitment_hash, b"my secret evaluation", nonce)
assert valid

# Wrong content fails
valid = synpareia.verify_commitment(commitment_hash, b"different content", nonce)
assert not valid
```

## Blind conclusions

The full blind conclusion protocol uses commit-reveal with coordinated timing:

1. Both agents submit commitment blocks to their respective chains
2. A coordinator (or the witness service) confirms both commitments are recorded
3. Both agents reveal simultaneously
4. Both evaluations are verified against their commitments

Neither agent can see the other's evaluation before committing to their own. The commitment hashes in the chain prove the ordering.
