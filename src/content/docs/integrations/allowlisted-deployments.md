---
title: Allowlisted deployments
description: If your harness restricts which tools an agent may call, a partial synpareia install can read as a broken product rather than a reduced one. Here is how to avoid that.
---

Many agent harnesses restrict which tools an agent may call — a sandbox policy, a security
review, or simply a decision to keep the tool surface small. Synpareia is fine with that. But
there are three things about how tool filtering usually works that will bite you if nobody
tells you, and one of them makes a correctly-restricted install look broken.

This page is written from a real deployment: a scout agent running behind a default-deny
allowlist, whose transcript we then read call-by-call.

## 1. A denied tool is usually still visible, and still callable

The common implementation of tool filtering is not a context-level filter that hides tools from
the model. It is a **call-time hook**: the model still sees the tool in its tool list, still
decides to use it, calls it, and receives a denial.

From the model's side that is indistinguishable from a broken product. It read a description
saying the tool does something useful, it called the tool for exactly that reason, and it got
an error. In the deployment we observed, the agent hit this three times before it stopped
trying — and it stopped trying with the *whole* toolkit, not just the denied tools.

Absence would be cleaner than denial. If your harness can genuinely remove tools from the
advertised list rather than reject them at call time, do that instead.

## 2. Server instructions survive filtering — use them

Because the filtering happens at call time, the MCP server's `instructions` string is
untouched. It arrives at the model at handshake, before any tool call, and it arrives even
when every tool is denied.

That makes the `instructions` string the one piece of guidance you can count on reaching the
model. **Put the substance in it, not a pointer to the substance.**

We know that because we got it wrong. `synpareia-trust-mcp` 0.8.0 delegated:

> …call `orient` first; it maps your situation to the right tools.

In the deployment we studied, the agent called `orient` five times successfully, received its
"call `learn(...)` for the details" pointers every time, and **never once followed one**. The
instructions arrived intact, exactly as this section promises; the substance was one hop away,
and the hop did not happen. An accurate pointer that nobody follows buys you nothing.

So if you are deploying under an allowlist, assume your agent reads the
`instructions` string and little else, and write your own system guidance accordingly. When a
release changes what synpareia's own `instructions` says, this page will quote the new string
and name the version it landed in.

## 3. Some tools only work in pairs

:::note[Two of the tools below are new in 0.9.0]
`record_interaction` and `set_reputation_consent` shipped in `synpareia-trust-mcp` 0.9.0. Their
pairing rule is the one most likely to bite you, so read it before you allow them. If you are
pinned below 0.9.0, they are not present at all.
:::

Two pairs in particular will produce confusing errors if you allow one half and deny the other.

| If you allow | You must also allow | Otherwise |
|---|---|---|
| `add_evaluation` | `remember_counterparty` | `add_evaluation` fails with `No record for identifier '<x>'`, because nothing ever created the record it attaches to |
| `record_interaction` | *(nothing on your side)* | but the **counterparty** must have called `set_reputation_consent`, or the network refuses the event outright |

The first is the one that bites integrators: the two tools look independent, the error message
names the identifier rather than the missing prerequisite, and an agent will usually respond by
retrying with a different identifier.

The second is not a bug — it is the consent model working. Synpareia refuses to record an event
about an agent who has not agreed to be recorded, and refuses it loudly rather than skipping it
quietly, so the caller knows the event did not land.

## A minimum useful allow-set

If you want a small surface that still does something worthwhile, this is a coherent one:

```
orient                  — so the agent can work out what applies
make_claim              — sign something
verify_claim            — check someone else's signature
witness_seal_timestamp  — prove something existed by a given time
witness_verify_seal     — check a seal offline
remember_counterparty   — create a local record
add_evaluation          — attach your judgement to it  (pairs with the above)
recall_counterparty     — read it back
```

That gives an agent the ability to prove its own claims, check others', and accumulate its own
memory of who it has dealt with — entirely locally, with no network calls except the seal.

Add `learn` if you want the agent able to go deeper on its own. Add `evaluate_agent` when you
are ready for the agent to consult the network, and `set_reputation_consent` once it ships.

## Verifying what your agent actually has

Two failure modes we have hit ourselves, both worth checking rather than assuming:

- **The allowlist is generated somewhere other than the config you are reading.** We once
  checked an agent's profile for a tools-allowlist key, found none, and concluded nothing was
  filtering — while a generated deny hook was mounted into the container. Read the enforced
  artifact, or read the transcript, not the intended config.
- **Your own documentation drifts from the enforced set.** The same deployment's agent
  instructions listed nine tools when the agent actually had ten, omitting `orient` — the
  single most important one. If the allow-set and the prose describing it are two
  hand-maintained lists, generate the prose from the list.

## See also

- [Trust Toolkit MCP](/integrations/trust-toolkit/) — the full tool surface, grouped by purpose
- [MCP server card](/.well-known/mcp/server-card.json) — machine-readable tool list and categories
