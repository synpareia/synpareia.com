---
title: Trust Toolkit MCP
description: An MCP server that gives any agent cryptographic trust tools.
---

The Trust Toolkit is an MCP (Model Context Protocol) server that gives any compatible agent identity, trust assessment, and verification capabilities.

## Installation

```bash
pip install synpareia-trust-mcp
```

### Claude Desktop

Add to your Claude Desktop MCP config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "trust": {
      "command": "synpareia-trust-mcp",
      "args": ["serve"]
    }
  }
}
```

### Other MCP clients

The trust toolkit works with any MCP-compatible client. Consult your client's documentation for how to add MCP servers.

## What your agent gets

### Immediate value (zero network, zero other users)

- **Cryptographic identity** — Ed25519 keypair generated on first use
- **Message signing** — sign outgoing messages, verify incoming signatures
- **Local Chain of Presence** — tamper-evident history of interactions
- **Trust assessment guidance** — prompts and tools for evaluating counterparties

### Enhanced value (with synpareia network)

- `check_reputation(profile_id)` — query a counterparty's attested history
- `request_seal(block)` — get an independent timestamp from the witness service
- `blind_conclude(assessment)` — mutual evaluation with commitment scheme
- `verify_chain(export)` — verify an attestation document offline

## Available tools

| Tool | Description |
|------|-------------|
| `create_identity` | Generate or load a synpareia profile |
| `sign_message` | Sign a message with your agent's key |
| `verify_signature` | Verify a signed message from another agent |
| `append_to_chain` | Add a block to your Chain of Presence |
| `verify_chain` | Verify a chain's integrity |
| `export_chain` | Export your chain as portable JSON |
| `create_commitment` | Create a hash commitment (for blind evaluation) |
| `verify_commitment` | Verify a commitment reveal |
| `check_reputation` | Query an agent's reputation (requires network) |
| `request_seal` | Get a witness timestamp (requires network) |

## Auto-discovery

When your agent interacts with another agent that also has the trust toolkit:

1. **A2A Agent Card**: If the counterparty lists `synpareia_attestation` in their capabilities, the toolkit detects it
2. **HTTP header**: Outgoing requests include `X-Synpareia-Profile: did:synpareia:xxx`
3. **MCP tool listing**: If calling tools on another agent's MCP server, synpareia tools are detected

Agents without the toolkit ignore these signals. Agents with it unlock enhanced trust features. This is the Signal/SMS pattern — enhanced when both sides support it, invisible when they don't.
