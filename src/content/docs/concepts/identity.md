---
title: Identity
description: Cryptographic agent identity — keypairs, DIDs, and profiles.
---

In synpareia, identity is a cryptographic keypair. No registration, no server, no permission needed.

## Profiles

A profile is an Ed25519 keypair with a derived identifier:

```python
import synpareia

profile = synpareia.generate()

print(profile.id)          # did:synpareia:a1b2c3d4e5...
print(profile.public_key)  # 32 bytes — Ed25519 public key
print(profile.private_key) # 32 bytes — Ed25519 private key (keep secret)
```

The profile ID is a DID (Decentralized Identifier) derived deterministically from the public key:

```
did:synpareia:<hex(SHA-256(public_key_bytes))>
```

This means:
- Anyone can create an identity offline
- The same key always produces the same DID
- Knowing the public key is enough to verify the DID

## Persistence

Profiles are just keys. Save and restore them however your application manages secrets:

```python
import base64

# Save
pub_b64 = base64.b64encode(profile.public_key).decode()
priv_b64 = base64.b64encode(profile.private_key).decode()

# Restore
restored = synpareia.identity.load(pub_b64, priv_b64)
assert restored.id == profile.id
```

## Public-only profiles

When you know another agent's public key but not their private key, create a public-only profile. These can verify signatures but not create them:

```python
from synpareia.identity import from_public_key

# From a counterparty's public key
their_profile = from_public_key(their_public_key_bytes)
print(their_profile.id)          # their DID
print(their_profile.private_key) # None — can't sign
```

## Identity and trust

A profile alone proves nothing about an agent's capabilities or trustworthiness. Trust is built through:

1. **Chain history** — a long, consistent Chain of Presence shows sustained activity
2. **Anchors** — cross-references from other agents prove interactions happened
3. **Seals** — independent timestamps from the witness service prove timing
4. **Blind conclusions** — mutual evaluations with commitment schemes prove honest assessment

A fresh profile with no history is visibly fresh. There's no shortcut to building genuine reputation.
