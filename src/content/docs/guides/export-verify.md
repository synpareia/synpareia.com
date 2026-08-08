---
title: Chain Export and Verification
description: Exporting chains as portable, independently verifiable documents.
---

Any synpareia chain can be exported as a self-contained JSON document. The export includes everything needed for independent verification — no synpareia access required.

## Exporting a chain

```python
import synpareia
import json
from synpareia import templates

profile = synpareia.generate()
chain = synpareia.create_chain(profile, policy=templates.cop(profile))

# Add some blocks
for i in range(5):
    block = synpareia.create_block(profile, "message", f"Action {i+1}")
    chain.append(block)

# Export with full content
export = synpareia.export_chain(chain)

# Save to file
with open("attestation.json", "w") as f:
    json.dump(export, f, indent=2)
```

## Export format

Two things surprise people, so they are shown rather than described: **sequence 1 is the
policy genesis block**, not your first message — the chain's rules are the first thing in it —
and **`content` is hex-encoded**, because a block's content is bytes and JSON has no byte type.

```json
{
  "version": "1.0",
  "chain_id": "chn_a1b2c3d4...",
  "owner_id": "did:synpareia:e5f6...",
  "chain_type": "cop",
  "created_at": "2026-04-13T10:00:00+00:00",
  "positions": [
    {
      "sequence": 1,
      "block": {
        "id": "blk_...",
        "type": "policy",
        "author_id": "did:synpareia:e5f6...",
        "content_hash": "04ab2fdf...",
        "created_at": "2026-04-13T10:00:00+00:00",
        "metadata": {},
        "content": "7b2261637469766174696f6e5f74696d656f75745f64617973...",
        "signature": "..."
      },
      "parent_hash": null,
      "position_hash": "..."
    },
    {
      "sequence": 2,
      "block": {
        "id": "blk_...",
        "type": "message",
        "author_id": "did:synpareia:e5f6...",
        "content_hash": "6e97f7e7...",
        "created_at": "2026-04-13T10:00:01+00:00",
        "metadata": {},
        "content": "416374696f6e2031",
        "signature": "..."
      },
      "parent_hash": "5222caad...",
      "position_hash": "..."
    }
  ],
  "head_hash": "...",
  "metadata": {},
  "policy_hash": "..."
}
```

`bytes.fromhex(block["content"]).decode()` on that second block gives `Action 1`.

## Privacy-preserving export

Export structure without content — useful for audit where you want to prove integrity without revealing what was said:

```python
export = synpareia.export_chain(chain, include_content=False)
# Blocks contain content_hash but not content
# Chain structure and integrity are still fully verifiable
```

## Independent verification

Verification needs two things: the export file, and the **public keys of whoever signed the
blocks**. The export deliberately does not carry them — a chain that shipped its own verifying
keys would let whoever produced the file choose which keys it is checked against. Publish them
alongside the export, or resolve them from the authors' profiles.

```python
import synpareia
import json

with open("attestation.json") as f:
    export = json.load(f)

# The verifier assembles this from keys it obtained independently — published
# alongside the export, or resolved from each author's profile. Here the chain has a
# single author, so it is one entry.
author_keys = {profile.id: profile.public_key}

# `public_keys` maps author id -> public key. Without it, verify_export returns
# False and says so, rather than reporting a chain as sound having checked no
# signatures.
valid, errors = synpareia.verify_export(export, public_keys=author_keys)
if valid:
    print(f"Chain verified: {len(export['positions'])} blocks, integrity intact")
else:
    for error in errors:
        print(f"Verification failed: {error}")
```

No network call and no synpareia service is involved — but "self-contained" means the *file*
needs no external lookup for its hash chain, not that signatures verify without keys.

Verification checks:
- Every position hash recomputes correctly from the block data
- Parent hashes form a valid chain (each references the previous)
- Block signatures are valid (if public keys are available)
- Head hash matches the last position's hash
- No gaps in the sequence

## Use cases

| Scenario | Export type |
|----------|------------|
| Full audit trail | `include_content=True` |
| Structural proof (privacy-preserving) | `include_content=False` |
| Selective disclosure | Export full, then redact specific blocks to hash-only |
| Cross-organization verification | Send export to counterparty for independent check |
