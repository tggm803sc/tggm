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
