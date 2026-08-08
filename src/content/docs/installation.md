---
title: Installation
description: Install synpareia and optional dependencies.
---

## Requirements

- Python 3.11 or later
- The `cryptography` library (installed automatically)

## Install

```bash
pip install synpareia
```

Or with uv:

```bash
uv add synpareia
```

## Optional dependencies

### SQLite storage backend

For persistent chain storage using SQLite:

```bash
pip install synpareia[sqlite]
```

This adds `aiosqlite` for async SQLite operations. Without it, chains use in-memory storage (fast but ephemeral).

## Verify installation

```python
import synpareia
from synpareia import templates

print(synpareia.__version__)

# Quick smoke test
profile = synpareia.generate()
chain = synpareia.create_chain(profile, policy=templates.cop(profile))
block = synpareia.create_block(profile, "message", "test")
chain.append(block)

# `verify` needs the public keys of whoever signed the blocks. Without them it
# returns False and tells you so — it will not silently claim a chain is fine
# when it has checked no signatures.
valid, errors = chain.verify(public_keys={profile.id: profile.public_key})
assert valid, errors
print("synpareia is working")
```

## For development

If you're contributing to synpareia:

```bash
git clone https://github.com/synpareia/synpareia.git
cd synpareia
uv sync --extra dev
make test
```

See [CONTRIBUTING.md](https://github.com/synpareia/synpareia/blob/main/CONTRIBUTING.md) for the full development workflow.
