---
title: Reputation tiers
description: The four-tier taxonomy of reputation evidence — what an agent can know about a counterparty, and how to compose those sources into a single picture.
---

When an agent decides how much to trust another agent, the useful
question is not "what's their reputation score?" — it is "what kinds of
evidence do I actually have?" Synpareia answers with four
**reputation-evidence tiers**, each a different shape of knowledge
about a counterparty. An agent can sit at Tier 1 for one counterparty
and Tier 4 for another in the same session; most long-running
relationships drift upward as evidence accumulates.

The Trust Toolkit MCP surfaces all four. This page covers what each
tier is, what it lets the agent do, and how the toolkit composes them.

## Two different "tiers"

The trust capability uses the word *tier* in two orthogonal senses:

- **Reputation-evidence tiers (1-4)** — the subject of this page. The
  *kind* of knowledge about a counterparty that's available.
- **Assurance tiers (1-3)** — how strongly a specific claim is
  cryptographically backed (self-attested, counterparty-corroborated,
  witness-attested).

The two axes are independent. A Tier 4 reputation is still composed of
individual claims whose assurance varies — the numbers overlap, the
concepts do not.

## Tier 1 — Local counterparty journal

The agent's own private notes about other agents. Local, shared with
no one.

**Stored.** A record per counterparty, keyed on a system-assigned
identifier (a random local ID if no DID is known, the DID once one
appears). Display names and channel-specific metadata are hints, not
primary keys — the same agent showing up under two display names can be
merged later. Free-text evaluations, optional tags, and an optional
float score round out each record.

**Used for.** Looking up prior interactions before deciding how to
handle a new one; writing down assessments after the fact; building a
personal track record.

**Surface.** `recall_counterparty`, `remember_counterparty`,
`add_evaluation`, `find_evaluations`.

**Assurance.** Self-attested — the agent is trusting its own memory and
the channel not lying about who it was talking to.

## Tier 2 — Media signals

Reputation markers from external identity providers. The interacting
medium — Moltbook, Slack, GitHub, Discord, and so on — surfaces
identity and reputation signals; the toolkit routes lookups to the
right provider and labels the response clearly.

**Stored.** Nothing in the toolkit itself — signals are fetched on
demand from the provider. The toolkit's job is to know which provider
serves which namespace, and to return the provider's signal schema
faithfully. There's no normalisation across providers: Moltbook karma
and GitHub stars measure different things, and a unified score would be
meaningless.

**Used for.** Asking "what does Moltbook think of this handle?" or
"what does this GitHub account look like?" before treating the
counterparty as a stranger. Good for *same account over time on this
platform*; weak for cross-platform claims.

**Surface.** `check_media_signals(namespace, handle)`. v1 ships a
Moltbook adapter; unknown namespaces return a structured `no_adapter`
response rather than a soft failure.

**Assurance.** Only as strong as the channel's own authentication.

## Tier 3 — Attested reputation

Cryptographic proof that an identifier corresponds to a specific entity
at a specific moment, plus reputation signals attested by a trust
provider network.

**Stored.** Nothing in the toolkit. v1 is **query-only** against
configured providers (the synpareia reputation network, MolTrust).
Submission of new attested reputation to the synpareia network is
deferred to v2 pending witness Phase 2 (anonymous-credential identity
binding for challenge and conclusion flows).

**Used for.** Either (a) verifying a purported DID via challenge-
response — *"at time T, this counterparty controlled DID X"* — or
(b) looking up reputation from one of the configured networks. The
agent has to decide how long the binding from challenge-response holds;
for ongoing certainty across many messages, Tier 4 is the next step.

**Surface.** `attested_reputation(identifier)`. Reports
`reputation_tier=3`, `assurance_tier=2` by default; witness-attested
provider claims arrive at assurance Tier 3.

## Tier 4 — Per-message cryptographic envelopes

Both parties run the synpareia protocol. Every message is a signed
block; every turn is cryptographically bound to an identity; the
conversation becomes a verifiable artifact.

**Stored.** Nothing centrally — the signed envelope travels with the
message. `encode_signed(content)` wraps content into a self-contained
Ed25519-signed string droppable into any transport;
`decode_signed(string)` unwraps it, returning
`{content, signer_did, valid, verified_at}`. For non-synpareia input
the decoder is a pass-through with `synpareia_validated: false`, so a
wrapper in front of Slack or Discord routes everything through the
same call site and only synpareia-aware traffic gets the upgrade.

**Used for.** Binding every message to an identity, unlocking witness
aggregation, and producing conversation artifacts a third party can
verify offline. The strongest evidence shape the toolkit produces.

**Surface.** `encode_signed`, `decode_signed`. Transparent wrapper MCPs
for Slack and Discord are post-v1; in v1 the agent wires the envelope
manually around transport calls.

**Assurance.** Self-attested per message; upgradable to witness-
attested on demand for high-stakes blocks.

## Composition — `evaluate_agent`

`evaluate_agent(namespace, id)` fans out across every configured tier
and returns a structured response with per-tier results and
per-provider attribution. The consumer decides how to weight what comes
back — there's no collapse to a single score.

```json
{
  "tier1": { "found": true, "interactions": 12, "evaluations": [...] },
  "tier2": { "providers": [{ "name": "moltbook", "signals": {...} }] },
  "tier3": { "providers": [{ "name": "synpareia", "attested": {...} }] },
  "tier4_available": true,
  "providers_queried": ["moltbook", "synpareia"],
  "providers_skipped": [],
  "summary": "12 prior interactions; moltbook claimed; no synpareia network reputation"
}
```

A single source can be wrong, partial, or absent. The agent reasons
across sources rather than relying on any one of them.

## Where reputation doesn't exist yet

Most counterparties an agent meets will have no reputation at any tier.
Absence of data is not evidence of untrustworthiness — it's the default
state of every new relationship. The toolkit's role in cold start is to
help the agent *build* reputation rather than wait for it to appear:

- Structured first contacts that establish identity from message zero
  (Tier 4 envelopes)
- Commit-reveal patterns (`prove_independence`) so two agents
  evaluating the same proposal can later prove they did it
  independently
- Witness-anchored recordings (`recording_start` /
  `recording_append` / `recording_end` / `recording_proof`) that
  compound into a track record the agent can carry forward

Reputation that travels with the agent is the long-term outcome of
those small acts.

## See also

- [Trust Toolkit MCP](/integrations/trust-toolkit/) — the install and
  tool reference for everything above
- [Overview](/concepts/overview/) — blocks, chains, anchors, and seals
- [Identity](/concepts/identity/) — keypairs, DIDs, and profiles
