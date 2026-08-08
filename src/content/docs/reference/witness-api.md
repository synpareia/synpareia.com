---
title: Witness API
description: HTTP wire reference for the synpareia witness service — seals, blind conclusions, liveness challenges, and ephemeral attestations.
---

Wire-format reference for the witness service. Every public endpoint accepts
hashes only — never content — and returns a witness-signed envelope verifiable
offline with the witness public key. For consumer-side envelope shapes see the
[SDK API reference](/reference/api/); for background, [How seals work](/concepts/seals/)
and [Run your own witness](/guides/self-hosted-witness/).

## Base URL

Reference instance: `https://synpareia-witness.fly.dev`
(public — anonymous access, no token; see Auth below).

Self-hosted instances follow the same path layout. Set
`SYNPAREIA_WITNESS_URL` (and `SYNPAREIA_WITNESS_TOKEN` if your
deployment is access-gated) to point the SDK at your deployment.
See [Run your own witness](/guides/self-hosted-witness/).

## Conventions

| Convention | Value |
|---|---|
| Content type | `application/json` (or any `*/*+json` per RFC 6839) |
| Hash encoding | 64-char lowercase hex (32 bytes, SHA-256) |
| Public key encoding | base64 (`*_b64`) and lowercase hex (`*_hex`) |
| Signature encoding | base64 (`*_b64`), Ed25519 over 64 bytes |
| Signed envelope | JCS-canonicalized (RFC 8785) JSON, returned base64 in `signing_envelope_b64` where applicable |
| DID format | `did:synpareia:[a-z0-9\-_]{4,128}` |
| Body size cap | 256 KiB |
| JSON nesting depth cap | 32 |

Signed responses return the exact signed bytes in `signing_envelope_b64`.
Offline verifiers reconstruct the envelope via the matching SDK helper and
reject any attestation whose reconstruction diverges before checking the
signature.

## Auth

The reference instance is public: anonymous access, no credentials on any
endpoint. Self-hosted deployments can enable an optional shared-secret gate
by setting `ACCESS_TOKEN`; gated instances then require this header on every
request except `/health` and `/health/ready`:

```
X-Access-Token: <token>
```

On gated instances, a missing or invalid token returns `403`. There is no
per-caller identity at the HTTP layer — the witness is a sparse attester;
DIDs in request bodies (challenges, conclusions) are protocol record, not
transport auth.

## Rate limits

Per-instance, applied by [slowapi](https://github.com/laurentS/slowapi).
Defaults (configurable via `WITNESS_RATE_LIMIT_*` env vars):

| Group | Default | Endpoints |
|---|---|---|
| `seals` | `60/minute` | `/api/v1/seals/*` |
| `conclusions` | `10/minute` | `/api/v1/conclusions/*` |
| `challenges` | `10/minute` | `/api/v1/challenges/*` |
| `default` | `60/minute` | everything else |

Exceeding a limit returns `429`. Behind a reverse proxy the key resolves to
the proxy IP — limits are per-instance, not per-client, until header-aware
extraction lands.

## Common errors

| Status | Cause |
|---|---|
| `400` | JSON nesting depth exceeded |
| `403` | Missing or invalid `X-Access-Token` (gated self-hosted deployments only) |
| `404` | Unknown seal / conclusion / challenge id |
| `413` | Request body exceeds 256 KiB |
| `422` | Validation failure (bad hex, bad DID, oversize field, malformed base64) |
| `429` | Rate limit exceeded |

---

## Health

### `GET /health`
Liveness probe. Always 200.

```json
{"status": "ok"}
```

### `GET /health/ready`
Readiness probe. Always 200.

Both health routes bypass the access-token middleware.

---

## Witness info

### `GET /api/v1/witness`
Returns the witness's public identity. Cache the result to verify seals
offline without a round trip.

Response:

```json
{
  "witness_id": "did:synpareia:abc...",
  "public_key_b64": "MCowBQYDK2VwAyEA...",
  "public_key_hex": "302a300506032b6570032100...",
  "version": "0.1.0"
}
```

---

## Seals

The public timestamp/state seal endpoints below carry no requester identity:
the persisted row stores `{seal_type, witness_id, target_block_hash` (or
`target_chain_id` + `target_chain_head`), `witness_signature, sealed_at}` and
leaves `requester_id` null — sparse-witness construction. Seals created by the
challenge/conclusion flows further down do populate `requester_id` internally,
pending Witness Phase 2's anonymous-credential identity binding.

### `POST /api/v1/seals/timestamp`
Witness signs `(block_hash, sealed_at)`.

Request:

```json
{"block_hash": "a1b2...c3d4"}
```

Response (`SealResponse`):

```json
{
  "seal_id": "seal_a1b2c3d4e5f6...",
  "seal_type": "timestamp",
  "witness_id": "did:synpareia:...",
  "witness_signature_b64": "...",
  "target_block_hash": "a1b2...c3d4",
  "target_chain_id": null,
  "target_chain_head": null,
  "sealed_at": "2026-05-12T08:00:00Z",
  "metadata": {}
}
```

### `POST /api/v1/seals/state`
Witness signs `(chain_id, chain_head, sealed_at)` — a checkpoint of a chain
at a specific head.

Request:

```json
{
  "chain_id": "cop:did:synpareia:.../main",
  "chain_head": "a1b2...c3d4"
}
```

`chain_id` is bounded to 256 characters. Response shape matches the
timestamp seal with `seal_type: "state"` and `target_chain_id` /
`target_chain_head` populated instead of `target_block_hash`.

### `GET /api/v1/seals/{seal_id}`
Retrieve a previously-issued seal. Returns the same `SealResponse` shape.

### `GET /api/v1/seals?seal_type=&limit=`
Query seals with optional filters. `limit` is capped at 100. Returns a list
of `SealResponse`.

---

## Blind conclusions

Two-party commit-reveal handle. Both parties submit commitments under the
same `conclusion_key`; the witness signs each commitment with a timestamp
seal and marks the conclusion `ready` once both have submitted. The witness
never sees the conclusion content.

> **Identity binding is self-asserted in v1.** The `requester_id` you submit
> is recorded verbatim — the witness does not verify that the caller controls
> that DID's key, so any caller can occupy a party slot under any DID. What a
> blind-conclusion seal proves is *that a commitment hash existed at a time,
> attributed to a claimed identity* — not that the claimed identity made it.
> If party authenticity matters, verify DID control at another layer (e.g.
> signed blocks exchanged between the parties whose hashes are what you
> commit). Cryptographic identity binding is Witness Phase 2 (roadmapped).

### `POST /api/v1/conclusions`
Submit one party's commitment. Idempotent for the same party; rejects a
third distinct party.

Request:

```json
{
  "conclusion_key": "match-2026-05-12-xyz",
  "requester_id": "did:synpareia:abc...",
  "commitment_hash": "a1b2...c3d4"
}
```

Response (`ConclusionResponse`):

```json
{
  "conclusion_key": "match-2026-05-12-xyz",
  "status": "waiting",
  "party_a": {
    "party_id": "did:synpareia:abc...",
    "commitment_hash": "a1b2...c3d4",
    "submitted_at": "2026-05-12T08:00:00Z",
    "seal_id": "seal_a1b2c3d4e5f6..."
  },
  "party_b": null,
  "expires_at": "2026-05-13T08:00:00Z"
}
```

`status` is `waiting` (one party submitted), `ready` (both submitted), or
`expired`. When the second party submits, the witness issues a timestamp
seal for each party's commitment and populates `party_a.seal_id` and
`party_b.seal_id`.

Default expiry is 24 hours (`WITNESS_CONCLUSION_EXPIRY_SECONDS`).

### `GET /api/v1/conclusions/{conclusion_key}`
Poll a blind conclusion by key. Returns the same `ConclusionResponse` shape.
Reveal of the underlying content is out-of-band — the witness only attests
to the commitments and their first-in-time ordering.

---

## Liveness challenges

Proves *someone* was online and produced a fresh block embedding the
witness's nonce within the deadline. The witness issues a nonce; the
responder embeds it in a fresh block; the witness checks the deadline and
seals the response block.

> **Identity binding is self-asserted in v1.** The witness checks the nonce,
> the deadline, and that the response's `requester_id` matches the
> `target_id` declared at issuance — but it does **not** verify that the
> responder controls the target DID's key. Anyone who knows the
> `challenge_id` can answer by claiming to be the target DID. To make a
> liveness proof identity-bearing today, independently verify that the
> response block is signed by the target DID's key (the SDK's `verify_block`
> with the DID's public key). Cryptographic identity binding at the witness
> layer is Phase 2 (roadmapped).

### `POST /api/v1/challenges`
Issue a challenge for a target DID.

Request:

```json
{
  "target_id": "did:synpareia:abc...",
  "chain_id": "cop:.../main"
}
```

`chain_id` is optional. Response (`ChallengeResponse`):

```json
{
  "challenge_id": "wch_a1b2c3d4e5f6...",
  "nonce_hex": "f3a1...",
  "deadline": "2026-05-12T08:01:00Z",
  "chain_id": "cop:.../main"
}
```

Default deadline is 60 seconds (`WITNESS_CHALLENGE_DEADLINE_SECONDS`).

### `POST /api/v1/challenges/{challenge_id}/respond`
Submit a response block hash. The responder must have constructed a block
whose content includes the challenge `nonce_hex`. The witness checks the
deadline and issues a timestamp seal on success.

Request:

```json
{
  "requester_id": "did:synpareia:abc...",
  "response_block_hash": "a1b2...c3d4"
}
```

Response (`ChallengeRespondResponse`):

```json
{
  "passed": true,
  "seal_id": "seal_a1b2c3d4e5f6...",
  "message": "ok"
}
```

`400` if the challenge id is unknown, already responded, or past deadline.

---

## Ephemeral attestations

Five stateless attestation types — the witness signs and returns; nothing is
persisted beyond the signing keypair and rate-limit state. Every response
has the same shape (`EphemeralAttestationResponse`):

```json
{
  "attestation_type": "...",
  "attestation_time": "2026-05-12T08:00:00Z",
  "witness_id": "did:synpareia:...",
  "payload": { /* per-attestation */ },
  "signing_envelope_b64": "...",
  "witness_signature_b64": "..."
}
```

### `POST /api/v1/attestations/liveness-relay`
Attest that a challenger-responder exchange occurred. No identities
persisted.

```json
{
  "challenger_did": "did:synpareia:a...",
  "responder_did": "did:synpareia:b...",
  "challenge_hash": "a1b2...c3d4",
  "response_hash": "e5f6...7890"
}
```

### `POST /api/v1/attestations/verify`
Witness verifies a signature over caller-supplied envelope bytes. Attests
signature validity, not semantic truth.

```json
{
  "envelope_b64": "...",
  "signer_public_key_hex": "302a300506032b6570032100...",
  "signature_b64": "..."
}
```

`envelope_b64` is capped at 8 KiB; `signature_b64` at 256 chars.

### `POST /api/v1/attestations/arbitrate`
v1 stub — records the request and returns the inputs signed. The witness
does NOT adjudicate; `caller_claimed_outcome` is co-signed verbatim and the
envelope carries `v1_stub: true`.

```json
{
  "predicate_name": "threshold_reached",
  "context_hash": "a1b2...c3d4",
  "caller_claimed_outcome": "true"
}
```

### `POST /api/v1/attestations/randomness`
VRF-shaped: the witness signs a domain-separated input derived from its
own ID and the `caller_input` (not the caller_input directly), and returns
the signature plus a `random` value computed as `SHA-256(signature)`.
Pure Ed25519 keeps signing deterministic, so the same `(witness, caller_input)`
pair yields the same `random` — and any verifier with the witness public key
can verify the signature and recompute `random` from it. (Verifiers verify
the signature; they don't reproduce it.) Response payload keys are
`{caller_input, vrf_signature, random}`.

```json
{"caller_input": "round-2026-05-12-1"}
```

### `POST /api/v1/attestations/query`
Signed answer to a structured query. v1 only recognises `is_alive` and
`service_version`; any other `query_key` returns `answer: "unknown"`.

```json
{
  "query_key": "service_version",
  "query_context": ""
}
```

---

## Fair exchange

### `POST /api/v1/fair-exchange`
Atomic conditional reveal between two parties: both submit
`{committed_hash, nonce_hex, content_b64}`. The witness checks each reveal
hashes as promised, then either signs a coordinated-release attestation or
returns `422` and signs nothing.

```json
{
  "party_a": {
    "did": "did:synpareia:a...",
    "committed_hash": "a1b2...c3d4",
    "nonce_hex": "f3a1...",
    "content_b64": "..."
  },
  "party_b": {
    "did": "did:synpareia:b...",
    "committed_hash": "e5f6...7890",
    "nonce_hex": "8c2d...",
    "content_b64": "..."
  }
}
```

`content_b64` is capped at 64 KiB per party. Response carries
`released: true`, both reveal bundles echoed back, and the witness's
signature over the canonical envelope. The witness keeps no copy.

---

## Response headers

Every response carries `Server: synpareia-witness` (the runtime identity is
suppressed at the uvicorn layer). The FastAPI docs surface (`/docs`,
`/redoc`, `/openapi.json`) is disabled outside development; `404` on those
paths is expected.
