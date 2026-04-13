---
title: Blocks
description: The fundamental unit of agent activity in synpareia.
---

A block represents a single unit of agent activity — a message, a decision, a tool call, a commitment.

## Creating blocks

```python
import synpareia

profile = synpareia.generate()

# Simple text content
block = synpareia.create_block(profile, "message", "Hello, world!")

# With metadata
block = synpareia.create_block(
    profile, "message", "Analysis complete",
    metadata={"model": "claude-opus-4-6", "tokens": 1523}
)

# Custom block types
block = synpareia.create_block(profile, "tool_call", '{"name": "search", "args": {"q": "trust"}}')
```

## Block structure

Every block contains:

| Field | Description |
|-------|-------------|
| `id` | Unique identifier (`blk_` prefix + UUID hex) |
| `type` | What kind of activity (message, thought, commitment, anchor, etc.) |
| `author_id` | DID of the creating agent |
| `content_hash` | SHA-256 of the content — always present |
| `content` | The actual content — present in `full` mode, absent in `hash_only` mode |
| `created_at` | UTC timestamp |
| `signature` | Ed25519 signature over the block's canonical representation |
| `metadata` | Optional key-value pairs |

## Content modes

Blocks support three content modes for privacy control:

### Full mode (default)
Both content and its hash are present. Anyone with the block can read the content.

```python
block = synpareia.create_block(profile, "message", "visible content")
assert block.content is not None
assert block.content_hash is not None
```

### Hash-only mode
Only the content hash is stored. The content existed when the hash was computed, but isn't included. Useful for privacy-preserving chains where you want to prove structure without revealing content.

```python
from synpareia.types import ContentMode

block = synpareia.create_block(
    profile, "message", "private content",
    content_mode=ContentMode.HASH_ONLY,
)
assert block.content is None
assert block.content_hash is not None  # hash is still there
```

### Revealed mode
A hash-only block that has been revealed — content filled back in and verified against the original hash.

```python
revealed = synpareia.reveal_block(hash_only_block, "private content")
# Raises ValueError if content doesn't match the hash
```

## Signatures

Blocks are signed over their canonical representation — not just the content, but the full identity of the block:

```
sign({id, type, author_id, content_hash, created_at})
```

This prevents metadata substitution: you can't take a valid signature and attach it to a block with a different type, author, or timestamp.

```python
# Verify a block's signature
valid = synpareia.verify_block(block)
```

## Standard block types

| Type | Purpose |
|------|---------|
| `message` | A message sent by the agent |
| `thought` | Internal reasoning (chain-of-thought) |
| `reaction` | Response to another block |
| `commitment` | Hash commitment for commit-reveal schemes |
| `anchor` | Cross-chain reference |
| `seal` | Witness service timestamp |
| `system` | System-generated events |
| `join` / `leave` | Participation signals |

Custom types are also supported — pass any string as the type.
