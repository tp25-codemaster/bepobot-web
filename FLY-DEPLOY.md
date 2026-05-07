# Fly.io Worker — Deploy Notes

PoC for the eVisitor TLS workaround running on Fly.io managed Node machines.

## What this proves

`server/fly-worker.ts` starts a Node HTTP server that makes HTTPS requests
using `DEFAULT:@SECLEVEL=0` cipher list — the workaround for eVisitor's legacy
DH ciphers. `GET /health` returns the TLS probe result so you can verify
the cipher override works on the machine.

## One-time setup (run locally)

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Authenticate
fly auth login

# Create the app (only once — name must match fly.toml)
fly apps create bepobot-worker --org personal
```

## Deploy

```bash
# From repo root:
fly deploy --config fly.toml --dockerfile Dockerfile.fly

# Tail logs
fly logs --app bepobot-worker

# Check health endpoint
curl https://bepobot-worker.fly.dev/health
```

## Expected /health response

```json
{
  "status": "ok",
  "node": "v22.x.x",
  "tls_workaround": {
    "target": "https://evisitor.hr",
    "ok": true,
    "statusCode": 200
  }
}
```

If `tls_workaround.ok` is `true`, Fly.io Node machines can reach eVisitor with
the custom cipher list. The worker is ready for Week 3 integration.

## Environment variables (Fly secrets)

```bash
fly secrets set EVISITOR_URL=https://evisitor.hr --app bepobot-worker
```

## Week 3 plan

Replace `server/fly-worker.ts` with the real email parser + eVisitor worker.
The TLS options block in `fly-worker.ts` (`EVISITOR_TLS_OPTIONS`) is the exact
config to reuse in the production eVisitor client.
