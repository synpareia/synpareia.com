---
title: Overview
description: What synpareia is for — commitments, records, checks and Forms — and the cryptographic primitives underneath them.
---

Synpareia is infrastructure for the moments when something is at stake between two agents.

Agents increasingly delegate to each other, rely on each other, and transact. What they lack is
any way to tell an agent that keeps its word from one that does not — and any way to make a
promise that is more than a sentence. The usual fix is a platform that keeps score, which makes
the platform the arbiter of who is trustworthy. Synpareia takes the other route: make the
**evidence** portable and checkable by anyone, so no arbiter is needed.

## The four things you actually do

**Commit.** State an intention in a form neither side can later quietly revise. A commitment you
both signed is a different object from one you both remember — it has a timestamp that predates
the outcome, and it says what "kept" would look like.

**Record.** Open a tamper-evident record *while* an interaction happens, not after. Both parties
can contribute; either can later export a portable proof that anyone can verify. A reconstructed
account is worth far less than a contemporaneous signed one, and the difference is legible to a
third party rather than a matter of who sounds more credible.

**Check.** Before relying on a counterparty, look at what is actually known about them: your own
prior dealings, attestations they can hand you, and signals from elsewhere. Often the honest
answer is "nothing" — which is useful, because it tells you to ask for a commitment rather than
proceed on goodwill.

**Follow a Form.** Some interaction shapes are well understood and easy to get wrong — escrow,
a trial period, a precommitment, a prediction you want believed later. A **Form** is a worked
recipe for one of these: the phases, who does what, where trust sits, and how it can be gamed.
You do not have to invent the choreography.

The Manual of Forms is not published on this site yet, and the Forms guides are not in the
currently-released Trust Toolkit either — they land in the next release. Until then, treat the
four moves above as the working vocabulary: a Form is a named, reusable arrangement of them.

## Where the cryptography sits

Everything above rests on four primitives. You rarely need to think in them — the tools are named
for the social act — but they are what makes the guarantees real, and you need them if you are
building on synpareia rather than using it.

The one property worth carrying with you: **anything synpareia produces verifies offline,
forever.** A proof is pure cryptography. It does not call home, does not need an account, and
does not stop working if synpareia does.

## Blocks

A **block** is a single unit of agent activity — a message sent, a decision made, a tool called, a commitment created. Every block contains:

- **Content** (or its SHA-256 hash, for privacy)
- **Author identity** (the agent's DID)
- **Ed25519 signature** (cryptographic proof of authorship)
- **Timestamp**
- **Type** (message, thought, reaction, commitment, anchor, etc.)

Blocks are immutable. Once created and signed, changing any field invalidates the signature.

## Chains

A **chain** is an ordered sequence of blocks, linked by cryptographic hashes. Each position in a chain includes a **position hash** computed from:

```
SHA-256(sequence : author_id : type : timestamp : content_hash : parent_hash)
```

This means:
- **Ordering is provable** — you can't reorder blocks without breaking hashes
- **Completeness is verifiable** — you can't remove a block without a gap in the sequence
- **Tampering is detectable** — modifying any block invalidates all subsequent position hashes

There are several chain types:
- **Chain of Presence (CoP)** — one agent's history of actions across all contexts
- **Sphere chain** — the shared history of a multi-agent interaction (a conversation, a crew run)
- **Custom chains** — any application-specific sequence

## Anchors

An **anchor** is a cross-chain reference — a block in one chain that points to a specific position in another chain. Anchors create verifiable links between independent histories.

Use cases:
- **Correspondence** — "I saw your message #5" (proves awareness at a point in time)
- **Receipt** — "I received and processed this" (proof of delivery)
- **Bridge** — linking a CoP to a sphere chain (agent participated in conversation)
- **Branch** — one chain referencing another's state as a starting point

Anchors are verified by checking that the referenced block's hash matches what the anchor claims. No trust required — the math either works or it doesn't.

## Anchors vs. Seals — the one-liner

The two are easy to confuse because both are about "this happened":

- **Anchor** = *"I saw your chain"* (in your own chain, you reference a position in someone else's). No third party involved.
- **Seal** = *"an independent witness saw mine"* (a third-party timestamp on your block's hash). The witness sees only the hash, never the content.

Anchors are free and offline; seals require a witness service.

## Seals (Tier 4)

A **seal** is an independent timestamp from a synpareia witness service. When an agent requests a seal, the witness:

1. Receives the block's hash (not its content — the witness is blind)
2. Timestamps it
3. Signs the timestamp with the witness's own key
4. Returns the seal

Seals prove that a block existed at a specific time, verified by an independent third party. They're useful for:
- Proving a commitment was made before a reveal
- Timestamping important decisions
- Establishing ordering between events across different chains

Seals are optional. Tiers 1-3 (blocks, chains, anchors) work fully offline with zero network calls.

## The trust model

Synpareia doesn't require trust. It provides **evidence**:

| Question | Evidence |
|----------|----------|
| "Who created this?" | Ed25519 signature on every block |
| "Was this modified?" | Hash chain — any change breaks subsequent hashes |
| "Did they see my message?" | Anchor referencing your block with matching hash |
| "Was this assessment independent?" | Commit-reveal — commitment hash published before reveal |
| "When did this happen?" | Seal from independent witness service |

A third party can verify any of these claims using only the exported chain data. No synpareia account, no API access, no trust in synpareia itself.
