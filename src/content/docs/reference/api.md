---
title: API Reference
description: Complete reference for the synpareia Python SDK public API.
---

## Identity

### `synpareia.generate() -> Profile`
Generate a new Ed25519 keypair and derive a DID.

```python
import synpareia

profile = synpareia.generate()
```

### `synpareia.identity.from_private_key(private_key: bytes) -> Profile`
Create a profile from an existing private key.

### `synpareia.identity.from_public_key(public_key: bytes) -> Profile`
Create a public-only profile (can verify but not sign).

### `synpareia.identity.load(public_key_b64: str, private_key_b64: str | None = None) -> Profile`
Restore a profile from base64-encoded keys.

### `Profile`
```python
from dataclasses import dataclass

@dataclass(frozen=True)
class Profile:
    id: str                    # did:synpareia:<hash>
    public_key: bytes          # 32-byte Ed25519 public key
    private_key: bytes | None  # 32-byte private key (None for public-only)
```

---

## Blocks

### `synpareia.create_block(profile, type, content, *, content_mode=ContentMode.FULL, metadata=None, sign=True) -> Block`
Create a new block.

| Parameter | Type | Description |
|-----------|------|-------------|
| `profile` | `Profile` | The author's profile (must have private key if `sign=True`) |
| `type` | `BlockType \| str` | Block type (message, thought, commitment, etc.) |
| `content` | `bytes \| str` | The block content |
| `content_mode` | `ContentMode` | `FULL` (default), `HASH_ONLY`, or `REVEALED` |
| `metadata` | `dict \| None` | Optional metadata key-value pairs |
| `sign` | `bool` | Whether to sign the block (default `True`) |

### `synpareia.reveal_block(block, content) -> Block`
Reveal a hash-only block by filling in its content. Raises `ValueError` if the content hash doesn't match.

### `synpareia.verify_block(block, author_public_key=None) -> bool`
Verify a block's content hash and signature.

### `Block`
```python
from datetime import datetime
from synpareia.types import BlockType

@dataclass(frozen=True)
class Block:
    id: str
    type: BlockType | str
    author_id: str
    content_hash: bytes
    content: bytes | None
    created_at: datetime
    signature: bytes | None
    metadata: dict
```

---

## Chains

### `synpareia.create_chain(owner, *, policy, store=None, metadata=None) -> Chain`
Create a new chain.

| Parameter | Type | Description |
|-----------|------|-------------|
| `owner` | `Profile` | The chain owner |
| `policy` | `Policy` | **Required, keyword-only.** The chain's rules — who may append, which block types are permitted, who must sign. Becomes the genesis block, so the chain's type and its rules are fixed together. Build one with `templates.cop(owner)`, `templates.sphere(a, b)`, `templates.audit(...)` or `templates.custom(...)`. |
| `store` | `ChainStore \| None` | Storage backend (default: `MemoryStore`) |
| `metadata` | `dict \| None` | Optional metadata |

### `Chain.append(block) -> ChainPosition`
Append a block to the chain. Returns the new position.

### `Chain.verify(*, public_keys: dict[str, bytes] | None = None) -> tuple[bool, list[str]]`
Verify the entire chain's integrity. Returns `(valid, errors)`.

`public_keys` maps author id → public key. **Omitting it returns `(False, [...])`**, not `True`:
signatures cannot be checked without keys, and the method says so rather than reporting a
chain as sound when it verified nothing. For a structure-only check that does not need keys,
use `verify_chain_structure`.

### `Chain.get_position(sequence) -> ChainPosition | None`
Get a specific position by sequence number.

### `Chain.get_block(sequence) -> Block | None`
Get the block at a specific sequence number.

### `Chain.query(*, block_type=None, author_id=None, limit=50) -> list[tuple[ChainPosition, Block]]`
Query blocks by type and/or author.

### Properties
- `chain.length` — number of blocks
- `chain.head` — latest `ChainPosition` (or `None` if empty)
- `chain.head_hash` — hash of the latest position

### `ChainPosition`
```python
@dataclass(frozen=True)
class ChainPosition:
    chain_id: str
    sequence: int
    block_id: str
    parent_hash: bytes | None
    position_hash: bytes
```

---

## Chain Export

### `synpareia.export_chain(chain, *, include_content=True) -> dict`
Export a chain as a JSON-serializable dictionary.

### `synpareia.verify_export(data, *, public_keys: dict[str, bytes] | None = None) -> tuple[bool, list[str]]`
Verify an exported chain without importing it.

Same rule as `Chain.verify`: **without `public_keys` this returns `(False, [...])`**, because
signatures cannot be checked without keys. An export is only independently verifiable if the
verifier also has the authors' public keys — publish them alongside it, or resolve them from
the authors' profiles.

---

## Anchors

### `synpareia.create_anchor_block(profile, source_chain, *, target_chain_id, target_sequence, target_block_hash, anchor_type=AnchorType.CORRESPONDENCE, metadata=None) -> tuple[Block, ChainPosition]`
Create an anchor block and append it to the source chain.

### `synpareia.anchor.verify.verify_anchor(anchor_block, target_chain) -> tuple[bool, str | None]`
Verify an anchor against its target chain.

### `synpareia.anchor.verify.verify_anchor_from_block(anchor_block, target_block, target_sequence) -> tuple[bool, str | None]`
Verify an anchor with just the target block (no full chain needed).

### `synpareia.anchor.traversal.find_anchors(chain, *, anchor_type=None) -> list[tuple[ChainPosition, AnchorPayload]]`
Find all anchor blocks in a chain.

### `synpareia.anchor.traversal.trace_correspondence(source_chain, target_chain) -> list[tuple[ChainPosition, ChainPosition]]`
Find all correspondence anchors between two chains.

---

## Commitments

### `synpareia.create_commitment(content, nonce=None) -> tuple[bytes, bytes]`
Create a commitment hash. Returns `(commitment_hash, nonce)`.

### `synpareia.verify_commitment(commitment_hash, content, nonce) -> bool`
Verify a commitment reveal. Uses constant-time comparison.

### `synpareia.create_commitment_block(profile, content, **kwargs) -> tuple[Block, bytes]`
Create a commitment block. Returns the block and the nonce for later reveal.

---

## Hashing

### `synpareia.content_hash(data: bytes) -> bytes`
SHA-256 hash, returns 32 bytes.

### `synpareia.jcs_canonicalize(obj: dict) -> bytes`
RFC 8785 JSON Canonicalization Scheme.

### `synpareia.canonical_hash(obj: dict) -> bytes`
Canonicalize then SHA-256.

---

## Signing

### `synpareia.sign(private_key: bytes, data: bytes) -> bytes`
Ed25519 signature.

### `synpareia.verify(public_key: bytes, data: bytes, signature: bytes) -> bool`
Verify an Ed25519 signature.

---

## Storage

### `ChainStore` (Protocol)
Interface for chain storage backends. Implement this for custom storage.

### `MemoryStore`
In-memory storage. Fast, ephemeral. The default.

### `SQLiteStore(db_path)`
SQLite-backed persistent storage. Install with `pip install synpareia[sqlite]`.

---

## Types

### Enums
- `BlockType` — message, thought, reaction, edit, retraction, join, leave, system, commitment, anchor, seal, state, media
- `ChainType` — cop, sphere, audit, custom
- `AnchorType` — correspondence, receipt, bridge, branch
- `ContentMode` — full, hash_only, revealed
