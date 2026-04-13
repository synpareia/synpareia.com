---
title: Chain Export and Verification
description: Exporting chains as portable, independently verifiable documents.
---

Any synpareia chain can be exported as a self-contained JSON document. The export includes everything needed for independent verification — no synpareia access required.

## Exporting a chain

```python
import synpareia
import json

profile = synpareia.generate()
chain = synpareia.create_chain(profile)

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
        "type": "message",
        "author_id": "did:synpareia:e5f6...",
        "content": "Action 1",
        "content_hash": "abcd1234...",
        "created_at": "2026-04-13T10:00:01+00:00",
        "signature": "..."
      },
      "parent_hash": null,
      "position_hash": "..."
    }
  ],
  "head_hash": "...",
  "metadata": {}
}
```

## Privacy-preserving export

Export structure without content — useful for audit where you want to prove integrity without revealing what was said:

```python
export = synpareia.export_chain(chain, include_content=False)
# Blocks contain content_hash but not content
# Chain structure and integrity are still fully verifiable
```

## Independent verification

Anyone with the export file can verify it:

```python
import synpareia
import json

with open("attestation.json") as f:
    export = json.load(f)

valid, errors = synpareia.verify_export(export)
if valid:
    print(f"Chain verified: {len(export['positions'])} blocks, integrity intact")
else:
    for error in errors:
        print(f"Verification failed: {error}")
```

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
