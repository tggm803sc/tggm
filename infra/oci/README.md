# TGG OCI Production Stack

Canonical OCI Resource Manager source for `tggm803sc/tggm`.

Default deployment:
- ARM `VM.Standard.A1.Flex` TGG control node.
- 2 OCPUs / 12 GB RAM defaults.
- Coolify bootstrap.
- public 80/443.
- admin-only 22/8000/6001/6002.
- Host Agent 8787 restricted to the private TGG VCN.
- optional x86 Unreal node OFF by default.

Security improvement: `admin_cidr` has no broad default. Supply your administrator public IP as a `/32` whenever possible.

After Resource Manager Apply, use `control_public_ip`, `coolify_setup_url`, `control_instance_id`, and `tgg_candidate_sha`. Finish domain/HTTPS setup, install the repo-native Host Agent, then run `npm run check:tgg-live-readiness`.

The optional x86 game node requires both `enable_game_node=true` and `allow_paid_game_node=true`.

## After Resource Manager Apply

Save the Terraform outputs as JSON, then run:

`python3 infra/oci/consume-apply-output.py --terraform-output <outputs.json> --out-dir <state-dir>`

This writes a bound `OCI_APPLY_HANDOFF.json` and non-secret `tgg-live.env`. It never invents a Host Agent URL.

After Coolify/domain/HTTPS is configured, rerun it with:

`--https-host-agent-url https://your-host-agent-domain`

Then verify the handoff and run the live readiness gate. The remote bearer token is never written by the bridge.


## Automatic Host Agent bootstrap

The control node now clones the public canonical repository and checks out the exact pinned control-plane commit `341dd14e4968abf8ca75a8809de06ba9d6ca78fa`. Cloud-init installs the repo-native Forge V14 Host Agent and R231 intake verifier, creates `tgg-host-agent.service`, starts it on host port `8787` while OCI ingress to that port remains closed, and verifies `/health`.

Terraform deliberately does **not** provision `TGG_REMOTE_TOKEN`. After Apply, inject that secret into `/etc/tgg-host-agent.env` through a secure administrator session, restart `tgg-host-agent`, then configure an HTTPS reverse proxy through the control plane. The control-node OCI security list does not expose port 8787. Coolify Traefik reaches the host service locally through `host.docker.internal:8787`.


## Secure HTTPS finalization

After OCI Apply and DNS are ready, run:

`sudo /opt/tgg/repo/infra/oci/finalize-host-agent.sh --domain host-agent.example.com --generate-token`

The finalizer stores the bearer token root-only, never prints the token value, configures Coolify Traefik via `/data/coolify/proxy/dynamic/`, enables Let's Encrypt TLS, routes to `host.docker.internal:8787`, verifies unauthenticated 401 plus authenticated no-op 404 behavior, and records only the SHA-256 token fingerprint.
