---
title: Chains
description: Hash-linked sequences of blocks — tamper-evident agent histories.
---

A chain is an ordered, hash-linked sequence of blocks. It's the core data structure for building verifiable agent histories.

## Creating chains

```python
import synpareia
from synpareia import templates

profile = synpareia.generate()

# Every chain carries a policy as its genesis block — who may append, which block
# types are allowed, who must sign. `templates.cop` is the single-owner default.
chain = synpareia.create_chain(profile, policy=templates.cop(profile))
```

Every chain has an owner (the profile that created it), a type, and a unique ID.

## Appending blocks

```python
block = synpareia.create_block(profile, "message", "First action")
pos = chain.append(block)

print(pos.sequence)       # 2 — position 1 is the chain's POLICY block
print(pos.position_hash)  # bytes — the hash linking this position to the chain
```

Each append returns a `ChainPosition` containing the sequence number, position hash, and parent hash (the previous position's hash, or `None` for the first block).

## Position hashes

The position hash is what makes chains tamper-evident. It's computed as:

```
SHA-256(sequence : author_id : type : created_at : content_hash : parent_hash)
```

Because each position hash includes the previous position's hash (`parent_hash`), modifying any block invalidates every subsequent position in the chain. This is the same principle behind Git's commit hashes.

## Verification

```python
valid, errors = chain.verify(public_keys={profile.id: profile.public_key})
if not valid:
    for error in errors:
        print(f"Integrity violation: {error}")
```

Verification walks the entire chain and checks:
- Every position hash recomputes correctly
- Every parent hash matches the previous position
- Every block signature is valid
- Sequence numbers are monotonically increasing

## Chain types

| Type | Purpose |
|------|---------|
| `cop` | **Chain of Presence** — one agent's history across all contexts |
| `sphere` | Shared history of a multi-agent interaction |
| `audit` | Audit trail for a specific process |
| Custom | Any string — application-specific chains |

The chain's type comes from its **policy**, not from a separate argument — the type and
the rules that go with it are one decision, so they are set in one place.

```python
from synpareia import templates

# A two-party sphere: both signatories may append.
counterparty = synpareia.generate()
chain = synpareia.create_chain(
    profile, policy=templates.sphere(profile, counterparty)
)

# An application-specific type, on otherwise single-owner rules.
chain = synpareia.create_chain(
    profile, policy=templates.cop(profile, chain_type="crew_execution")
)
```

## Querying

```python
# Get a specific position
pos = chain.get_position(5)

# Get the block at a position
block = chain.get_block(5)

# Query by type or author
results = chain.query(block_type="message", limit=10)
for pos, block in results:
    print(f"[{pos.sequence}] {block.content}")

# Chain metadata
print(chain.length)    # number of blocks
print(chain.head)      # latest position
print(chain.head_hash) # hash of latest position
```

## Storage backends

Chains need somewhere to store their blocks and positions.

### In-memory (default)
Fast, ephemeral. Data is lost when the process exits.

```python
chain = synpareia.create_chain(profile, policy=templates.cop(profile))  # uses MemoryStore
```

### SQLite
Persistent storage using SQLite. Install with `pip install synpareia[sqlite]`.

```python
from synpareia.chain.storage.sqlite import SQLiteStore

store = SQLiteStore("chains.db")
chain = synpareia.create_chain(profile, policy=templates.cop(profile), store=store)
# Data persists across process restarts
```

### Custom backends
Implement the `ChainStore` protocol for any storage backend:

```python
from synpareia.chain.storage import ChainStore

class MyStore(ChainStore):
    def store_block(self, chain_id, block): ...
    def store_position(self, chain_id, position): ...
    def get_block(self, block_id): ...
    # ... see API reference for full protocol
```
