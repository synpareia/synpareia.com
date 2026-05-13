---
title: Running your own witness
description: A practical guide to deploying, operating, and exposing a self-hosted synpareia witness — keys, env vars, access gating, and the verifier perspective.
---

The synpareia reference witness at `synpareia-witness.fly.dev` is one instance of an open protocol. The witness service has no special privileges; anyone can run their own, sign seals with their own key, and have downstream consumers verify those seals offline using the synpareia SDK. This guide walks through that end-to-end.

## When you'd want your own witness

The reference instance is fine for development and for most early users. Reach for a self-hosted witness when:

- **Regulated environment** — compliance doesn't allow load-bearing timestamps from a third party, or requires the witness identity to belong to your organisation.
- **Jurisdictional preference** — you want the signing key, the logs, and the data residency under a specific legal regime.
- **Operator-identity bearing** — downstream verifiers should see your name on the attestation, not synpareia's.
- **Access-policy control** — you set your own gating, rate limits, retention.

If none apply, the reference instance is the lower-friction path. Everything below transfers cleanly when you do migrate.

## Generating a witness keypair

The witness identity is an Ed25519 keypair. The public key is what consumers will pin and verify against; the private key never leaves the witness machine.

The witness service can generate one on first boot (it'll write to `WITNESS_KEY_PATH` and chmod it `0600`), but most operators want to generate the key ahead of time and inject it as a secret. The simplest path uses Python from the SDK install:

```python
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
import base64

key = Ed25519PrivateKey.generate()
private_b64 = base64.b64encode(key.private_bytes_raw()).decode()
public_hex = key.public_key().public_bytes_raw().hex()

print("Private (set as WITNESS_PRIVATE_KEY_B64):", private_b64)
print("Public  (publish for verifiers):         ", public_hex)
```

Store the private value in your secrets manager. Anyone who has it can forge seals that look like they came from your witness — treat it with the same care as a TLS server key.

## Configuring the service

The witness service reads its configuration from environment variables. The full set is documented in `witness/src/witness/config.py`; the load-bearing ones are:

| Variable | Purpose |
|----------|---------|
| `WITNESS_PRIVATE_KEY_B64` | Base64-encoded Ed25519 private key. Highest-priority key source. |
| `WITNESS_KEY_PATH` | Fallback path for an on-disk key file. Generated and persisted there on first boot if neither variable is set. |
| `DATABASE_URL` | SQLAlchemy URL. Defaults to local SQLite. Use Postgres for any deployment with more than one machine. |
| `ACCESS_TOKEN` | Optional shared-secret middleware. When set, every non-health request must carry `X-Access-Token: <value>` or get a `403`. |
| `ENVIRONMENT` | `production` (default) disables `/docs`, `/redoc`, and `/openapi.json`. Set to `development` only when you actually want the docs surface. |
| `SENTRY_DSN` | Optional. Wires unhandled exceptions and structured logs into Sentry. |
| `WITNESS_RATE_LIMIT_DEFAULT` / `_SEALS` / `_CONCLUSIONS` / `_CHALLENGES` | Slowapi-format rate-limit strings (e.g. `60/minute`). Defaults are sensible for low-traffic deployments. |

**Database choice:** SQLite via `aiosqlite` is the default and works fine for a single-machine deployment with a persistent volume. If you intend to run more than one witness machine behind a load balancer, you'll need Postgres — the witness uses transactional INSERTs to defend against TOCTOU races on blind-conclusion submission, and that defence depends on the database enforcing uniqueness across all replicas.

## Deploying to Fly.io

The reference deployment runs on Fly.io and the project ships its `fly.toml` and `Dockerfile` as the canonical configuration. The fastest path:

```bash
# From a checkout of the synpareia monorepo
cd witness

# Create the app (one-time)
fly apps create your-witness

# Set the private key + access token as secrets
fly secrets set \
    WITNESS_PRIVATE_KEY_B64="$(cat private.b64)" \
    ACCESS_TOKEN="$(openssl rand -hex 32)" \
    -a your-witness

# Create the persistent volume for SQLite + key fallback
fly volumes create witness_data --region syd --size 1 -a your-witness

# Deploy
fly deploy -c fly.toml -a your-witness
```

For repeat deployments, wrap `fly deploy` with a bounded post-deploy health-check loop — Fly's auto-stop/start means a cold deploy needs a moment to boot before `/health` responds. A minimal version that fails after 2 minutes rather than hanging forever:

```bash
fly deploy -c fly.toml -a your-witness && \
  for _ in $(seq 1 60); do
    curl -fs https://your-witness.fly.dev/health > /dev/null && break
    sleep 2
  done
```

If the loop exits without `/health` responding, check `fly logs -a your-witness` and `fly status -a your-witness` — the deploy itself may have failed.

## Deploying elsewhere

The `Dockerfile` is the canonical reference and runs anywhere a container does: Python 3.12 slim, non-root `appuser`, `/data` for SQLite + key fallback, `uvicorn` on `0.0.0.0:8000` with `--no-server-header`, `/health` HTTP healthcheck. Kubernetes, a plain VPS with `docker compose`, ECS, Cloud Run — all viable. You'll need a persistent volume mounted at `/data` (or an external Postgres), the env vars above, and an ingress that gates everything except `/health`. Don't run two replicas against the same SQLite volume; either pick one or move to Postgres.

## Access-gate posture

Synpareia's deployment posture is gated-by-default. If your witness is reachable from the public internet, it should sit behind either a shared-secret middleware, private networking, or an identity-bound proxy. The built-in `ACCESS_TOKEN` middleware (in `witness/src/witness/main.py`) is the simplest option — set the env var and every non-health request needs an `X-Access-Token` header. Your own ingress / WAF / mTLS layer works equally well, as does running the witness behind a private network like Tailscale or a WireGuard mesh.

Two notes on the access gate:

1. **It's not the same as the witness blindness property.** The witness sees only hashes regardless of access policy. The gate decides *who can submit hashes*, not whether the witness can read them.
2. **`/health` is exempt.** Monitoring needs to hit it without credentials. Don't expose any other route unauthenticated.

## Distributing your public key

A seal is useless without the public key it was signed against, so consumers need a reliable way to fetch yours. The witness exposes its own identity at `GET /api/v1/witness`, which returns a JSON object containing `witness_id`, `public_key_b64` (base64), and `public_key_hex` (hex). Pin whichever encoding fits your verifier path. Three patterns work:

- **Well-known URL.** Publish the key bytes at a stable HTTPS URL you control (`https://your-org.example/.well-known/synpareia-witness-key`). Consumers fetch once, pin, and verify offline thereafter.
- **In-band on first contact.** Any client using the SDK's `WitnessClient` can pull the key from the `/witness` endpoint when it first connects, then cache it.
- **Out-of-band.** Hand the bytes to known consumers directly (a contract appendix, a configuration step in your SDK distribution, an environment variable in their deployment). Most regulated deployments end up here.

Whichever you pick, the key is the trust anchor. If you ever rotate it (see "key rotation" below), every consumer needs to learn the new one before they can verify seals signed under it.

## Operating the service

Day-to-day operations look like any FastAPI service:

- **Health.** `GET /health` is unauthenticated; use it for your load balancer and uptime monitor.
- **Logs.** Structured JSON log lines (`witness.http`, `witness.app`). Per the sparse-witness construction, request logs deliberately do not include client IPs alongside seal hashes — preserve that property if you swap in your own logging stack.
- **Sentry.** Set `SENTRY_DSN` and unhandled errors flow there.
- **Rate limits.** Slowapi, keyed by remote IP. Tune the four `WITNESS_RATE_LIMIT_*` env vars without redeploying code; values are re-read on machine boot.

**Key rotation is a known gap.** The service signs every seal with its single configured key; there is no in-protocol rotation flow yet, and changing the key invalidates every previously-issued seal from the verifier's perspective. Plan to keep the same key for the lifetime of the seals you've issued, or coordinate a key-change announcement out-of-band. A proper rotation chain (witness publishes a successor key, signs the handover, both keys valid during overlap) is on the roadmap but not built — don't rely on it pre-launch.

## The verifier perspective

The whole point of a witness seal is that a third party can verify it without contacting either the witness or the original parties. Here's what that looks like for a consumer of *your* witness's seals:

```python
import synpareia
from synpareia.seal import SealPayload
from synpareia.seal.verify import verify_seal, verify_seal_block

# 1. The consumer has these three things:
#    - The seal envelope (as bytes, or as a SealPayload)
#    - Your witness's public key (32 raw bytes)
#    - Optionally, the original block hash they want to confirm

your_witness_public_key = bytes.fromhex(
    "abcd...your-32-byte-public-key-in-hex..."
)

# 2. Verify the signature only — does this seal genuinely come from
#    the witness whose public key we're holding?
ok, err = verify_seal(seal, your_witness_public_key)
if not ok:
    raise ValueError(f"Seal failed verification: {err}")

# 3. Verify that the seal covers the *specific* block hash they expected.
#    This is the load-bearing check: a valid seal over the wrong hash
#    is useless.
expected_hash = synpareia.content_hash(b"the content they're verifying")
ok, err = verify_seal_block(
    seal,
    your_witness_public_key,
    expected_block_hash=expected_hash,
)
if not ok:
    raise ValueError(f"Seal does not cover expected hash: {err}")

print(f"Verified: {seal.witness_id} sealed this at {seal.sealed_at}")
```

There is no network call in any of that. The consumer needs the seal bytes, your public key, and (for hash-binding) the original content or hash. If those three things check out, the seal is valid — independently of whether your witness service is still online or you're still running it.

## Cross-references

- [Concepts: seals](/concepts/seals/) — the protocol semantics
- [Reference: witness API](/reference/witness-api/) — full endpoint shapes
- [Reference: SDK](/reference/api/) — `synpareia.seal`, `synpareia.witness`, `WitnessClient`

The witness service source lives in the synpareia monorepo; the `Dockerfile`, `fly.toml`, and `config.py` referenced above are the canonical files. The service itself is not currently published as a standalone PyPI package — it's deployed from source.
