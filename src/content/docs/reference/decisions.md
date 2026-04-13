---
title: Architecture Decisions
description: Why synpareia makes the choices it does.
---

## Why Ed25519?

Ed25519 is the standard for modern digital signatures:
- Fast: signing and verification in microseconds
- Small: 32-byte keys, 64-byte signatures
- Deterministic: same input always produces the same signature (no randomness needed)
- Widely supported: `cryptography` library, hardware security modules, browser WebCrypto

We considered ECDSA (more common in blockchain), but Ed25519 is simpler, faster, and has fewer implementation pitfalls.

## Why SHA-256 (not SHA-3)?

SHA-256 is ubiquitous. Every language, every platform, every hardware accelerator supports it. SHA-3 is technically newer but offers no practical advantage for our use case and would limit interoperability.

## Why JCS (RFC 8785) for canonicalization?

When hashing JSON objects, you need a canonical form — otherwise `{"a":1,"b":2}` and `{"b":2,"a":1}` produce different hashes despite being semantically identical.

JCS (JSON Canonicalization Scheme) is an IETF standard (RFC 8785) that defines deterministic JSON serialization: sorted keys, specific number formatting, no whitespace. We implement a minimal subset (~60 lines) since our domain uses only strings, integers, booleans, None, lists, and dicts — no floating-point edge cases.

We considered other approaches:
- **CBOR canonical form**: more compact but less human-readable
- **Custom sort**: works but isn't a standard — harder for third parties to verify
- **bencode**: compact but niche

## Why linear chains (not DAGs)?

Each chain is a strict linear sequence. We considered directed acyclic graphs (like Git or IPFS) but rejected them:

- **Simplicity**: linear chains are trivial to verify — walk forward, check hashes
- **Clear ordering**: sequence numbers give unambiguous ordering within a chain
- **Cross-chain relationships are explicit**: anchors (not implicit graph edges) connect chains
- **Agent history is inherently sequential**: an agent does one thing at a time

DAGs would be useful for collaborative editing (like CRDTs), but synpareia models agent *histories*, not collaborative documents.

## Why frozen dataclasses (not Pydantic)?

Blocks and chain positions are frozen dataclasses with no framework dependency beyond `cryptography`. We considered Pydantic but:

- **Immutability is a protocol requirement**: blocks must not change after creation. Frozen dataclasses enforce this at the language level.
- **Zero dependency**: Pydantic adds a large dependency tree. The SDK should be lightweight.
- **Performance**: dataclass construction is faster than Pydantic model creation.
- **Simplicity**: no validation magic, no serialization config. What you see is what you get.

## Why synchronous interface?

The SDK uses synchronous calls throughout, including SQLiteStore (which uses stdlib `sqlite3`, not `aiosqlite`).

- **Agent runtimes are often synchronous**: CrewAI, LangGraph, and many custom agent frameworks run synchronously
- **Simplicity**: no async/await, no event loops, no runtime complications
- **Easy to wrap**: a sync interface is trivially wrapped in async if needed; the reverse is much harder

## Why position hash includes parent_hash?

The position hash formula:

```
SHA-256(sequence : author_id : type : created_at : content_hash : parent_hash)
```

Including `parent_hash` means each position hash depends on the entire chain history before it. Without it, an attacker could modify an earlier block and recompute only that block's position hash. With it, modifying any block invalidates every subsequent position hash — a single tampered block cascades through the rest of the chain.

## Why `blk_` and `chn_` prefixes?

Prefixed IDs (`blk_a1b2c3...`, `chn_d4e5f6...`) make it immediately obvious what kind of entity you're looking at in logs, exports, and debugging. This is a convention borrowed from Stripe's API design.
