---
title: Two operators, end-to-end
description: A worked example of two agents from different operators signing, exchanging, and verifying — with a third-party auditor.
---

This is the scenario synpareia is built around: two agents from **different operators** need to interact, and a **third party** needs to verify what happened later — without trusting either operator's logging.

We'll walk through the full loop: Alice (at operator A) and Bob (at operator B) exchange signed claims, both sides sign a shared chain, and Carol (an auditor at a third organisation) verifies the whole thing offline using only what Alice and Bob made public.

## What we'll build

```
┌────────────────┐     1. send chain bytes     ┌────────────────┐
│  Alice         │ ──────────────────────────► │  Bob           │
│  (operator A)  │                             │  (operator B)  │
└────────────────┘ ◄────────────────────────── └────────────────┘
                      2. send signed review
                                 │
                                 ▼  3. send full chain to Carol
                       ┌────────────────┐
                       │  Carol         │
                       │  (auditor)     │
                       └────────────────┘
```

Each agent owns its own private key; the public keys are shared out-of-band. Carol receives the chain bytes plus both public keys and verifies offline — no synpareia service required.

## Setup

Both sides install synpareia.

```bash
pip install synpareia
```

The two snippets below run on **different machines**. Each agent generates its own keypair locally and never sees the other's private key. They exchange **DIDs and public keys** out-of-band before interacting (A2A agent cards at `/.well-known/agent-card.json`, a profile directory, or any other channel that won't get tampered with).

```python
# === Alice's machine — operator A ===
import synpareia

alice = synpareia.generate()
print(f"Alice's DID: {alice.id}")
print(f"Alice's public key (hex): {alice.public_key.hex()}")
# Share the DID + public-key hex out-of-band so Bob and Carol can verify.
```

```python
# === Bob's machine — operator B (separate process, separate organisation) ===
import synpareia

bob = synpareia.generate()
print(f"Bob's DID: {bob.id}")
print(f"Bob's public key (hex): {bob.public_key.hex()}")
# Share Bob's DID + public-key hex out-of-band as well.
```

Each agent ends up with a `Profile` carrying its own private key. Only the **DIDs** (`did:synpareia:<sha256(public_key)>`) and **public keys** cross the operator boundary.

## 1. Alice signs a research summary

Alice creates a chain that names both her and Bob as signatories. Bob's `Profile` on Alice's machine is a **public-only** reconstruction from the public-key bytes Bob shared — Alice never has Bob's private key.

```python
# === Alice's machine — operator A ===

# Bob's public key, received out-of-band (e.g. from his A2A agent card). On Alice's
# real machine this is a hex string she pasted; here it is read back from what Bob
# printed above, so the page runs end to end as one script. Substituting a literal
# `bytes.fromhex("<bob's hex>")` changes nothing else.
BOB_PUBLIC_KEY = bytes.fromhex(bob.public_key.hex())

# Reconstruct a verify-only Profile for Bob from his public key.
# This Profile can identify Bob and verify his signatures, but cannot sign on his behalf.
bob_pubonly = synpareia.from_public_key(BOB_PUBLIC_KEY)

chain = synpareia.create_chain(
    alice,
    policy=synpareia.policy.templates.sphere(alice, bob_pubonly),
)

chain.append(
    synpareia.create_block(
        alice,
        "message",
        "Research summary: protocol X reduces latency by 30% under load.",
    )
)

# Export the chain as a self-contained JSON document (dict, ready to serialise).
chain_export = synpareia.export_chain(chain)

# Alice serialises it and sends — file, email, HTTP, whatever.
import json
wire_bytes = json.dumps(chain_export).encode()
```

`chain_export` is a portable JSON document that contains the block, Alice's signature on it, and the chain's policy. Alice sends the serialised bytes anywhere — they're not secret; the security is in the signatures, not the transport.

## 2. Bob receives, verifies, and reviews

Bob runs on a different machine. He has Alice's published DID and public key from the same out-of-band exchange. He doesn't have her private key (and doesn't need it).

```python
# === Bob's machine — operator B ===
import json
import synpareia
from synpareia.chain.operations import chain_from_export

# Alice's identifiers, received out-of-band before the interaction. On Bob's real
# machine these are literals he pasted; here they are read back from what Alice
# printed above, so the page runs end to end as one script.
ALICE_DID = alice.id
ALICE_PUBLIC_KEY = bytes.fromhex(alice.public_key.hex())

# Reconstruct the chain from Alice's wire bytes.
wire_bytes_received = wire_bytes  # however Bob received them
incoming = chain_from_export(json.loads(wire_bytes_received))

# Verify Alice's signature on her block before continuing.
valid, errors = incoming.verify(
    public_keys={ALICE_DID: ALICE_PUBLIC_KEY},
)
assert valid, f"Alice's chain failed to verify: {errors}"

# Bob is satisfied; append his signed review to the same chain.
incoming.append(
    synpareia.create_block(
        bob,
        "message",
        (
            "Reviewed Alice's summary. Methodology is sound; "
            "recommend reproduction before publication."
        ),
    )
)

# Export the now-bilateral chain.
bilateral_export = synpareia.export_chain(incoming)
bilateral_wire_bytes = json.dumps(bilateral_export).encode()
```

The chain now carries **two signed blocks** from **two different keys**. Neither Alice nor Bob can later modify what they said; their signatures lock the content. Neither can rewrite history; the position-hash linking would break.

## 3. Carol audits

Carol works at a third organisation. She receives the bilateral chain bytes from either Alice or Bob, plus both published public keys. She has no synpareia account and no network access — and she doesn't need them.

```python
# === Carol's machine — auditor, operator C ===
import json
import synpareia

# Both DIDs and public keys, received out-of-band (or pulled from the parties'
# published agent cards). On Carol's real machine these are four literals she
# pasted; here they are read back from what Alice and Bob printed, so the page
# runs end to end as one script.
ALICE_DID = alice.id
ALICE_PUBLIC_KEY = bytes.fromhex(alice.public_key.hex())
BOB_DID = bob.id
BOB_PUBLIC_KEY = bytes.fromhex(bob.public_key.hex())

bilateral_export = json.loads(bilateral_wire_bytes)
valid, errors = synpareia.verify_export(
    bilateral_export,
    public_keys={
        ALICE_DID: ALICE_PUBLIC_KEY,
        BOB_DID: BOB_PUBLIC_KEY,
    },
)

if valid:
    print("Verified. Both Alice and Bob signed the blocks attributed to them.")
    print("Neither has modified any block since signing.")
else:
    print(f"Verification failed: {errors}")
```

`verify_export` walks the chain, checks every block's hash against the previous position, and verifies every signature against the supplied public keys. If any link is broken, any signature is invalid, or any content was modified, verification fails with a structured error pointing at the specific block.

**This is the load-bearing property:** Carol doesn't have to trust Alice's logging, Bob's logging, or any platform between them. The chain bytes plus the public keys are enough.

## What this gives you that hand-rolled signing doesn't

If you're tempted to just sign JSON and ship it yourself, the things synpareia gives you that you'd otherwise re-invent:

- **Canonicalisation that survives serialisation round-trips.** Synpareia uses [JCS (RFC 8785)](https://datatracker.ietf.org/doc/html/rfc8785) so the *same* logical block produces the *same* hash regardless of key ordering or whitespace.
- **Position hashes linking each block to its predecessor.** Removing or reordering a block breaks every subsequent hash.
- **A policy primitive** that names who is allowed to sign which kinds of blocks, baked into the chain itself — Alice and Bob are *named signatories*, not "anyone with a key."
- **Witness seals and anchors** as composable extensions when you need a third-party timestamp or a cross-chain reference.
- **Interop**: if the other party also has synpareia, you don't have to negotiate the shape of the envelope — it's the same primitive on both sides.

The fastest way to need all of these is to ship a single hand-rolled signing system and discover the second use case.

## Witness-attested variant (Tier 4)

If Bob also wants a third-party timestamp on his block, he can request a witness seal. The witness sees only the hash, not the content; the seal proves the hash existed at the witness's clock-time:

```python
# Bob's machine — additionally pin the block to a witness clock.
# Requires `pip install synpareia[witness]` and a witness base URL Bob trusts.
import asyncio
import os
from synpareia.witness import WitnessClient

review_block = synpareia.create_block(
    bob, "message", "...",
)
incoming.append(review_block)


# The client is an async context manager, so it needs an async function around it —
# `async with` at module level is a SyntaxError. The SDK client takes the base URL
# explicitly; read it from your environment of choice (the Trust Toolkit MCP reads
# SYNPAREIA_WITNESS_URL by convention, the SDK client does not auto-pick-up env vars).
async def seal_with_witness(block, base_url):
    async with WitnessClient(base_url=base_url) as witness:
        return await witness.timestamp_seal(block_hash=block.content_hash)


witness_url = os.environ.get("WITNESS_BASE_URL")
if witness_url:
    seal = asyncio.run(seal_with_witness(review_block, witness_url))
    # Bundle the seal alongside the chain bytes so Carol can verify both.
```

Now Carol has Bob's signature *and* the witness's signature on the same hash — a third-party-anchored record that's verifiable without trusting Alice, Bob, or the witness's content (only the witness's clock and signing key).

Witness seals are optional. Tiers 1–3 (blocks, chains, anchors) work fully offline with zero network calls.

## Where next?

- [Concepts overview](/concepts/overview/) — blocks, chains, anchors, seals
- [Building a Chain of Presence](/guides/chain-of-presence/) — the single-agent variant
- [Trust Toolkit MCP](/integrations/trust-toolkit/) — drop these primitives into Claude Code, Cursor, or any MCP client
- [CrewAI integration](/integrations/crewai/) — wiring the Trust Toolkit into a CrewAI Crew
