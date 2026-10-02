# TGG OCI Video AI Control Host

This branch preserves the existing `oci-stack-v1` infrastructure design but adds an exact, non-deploying checkout of the frozen Video AI v1 release.

Pinned Video AI release:
- Branch: `release/tgg-video-ai-v1`
- SHA: `469518eff0fe1641f6889c5ff78c2f3c0df189c7`

Safety/cost defaults:
- Control host: `VM.Standard.A1.Flex`, 2 OCPUs, 12 GB RAM, 50 GB boot volume.
- Optional x86 Unreal node: OFF by default.
- `allow_paid_game_node`: false by default.
- This stack does not deploy Video AI and does not execute R232.
- Cloud-init clones and verifies the exact Video AI release, then writes `/var/lib/tgg-host-agent/video-ai-release-bootstrap.json` with `productionDeployed: false`.

After OCI Apply:
1. capture `control_public_ip`
2. inject `TGG_REMOTE_TOKEN` securely
3. configure HTTPS/DNS for the Host Agent
4. verify the pinned Video AI checkout receipt
5. run the existing Video AI canary → host bootstrap → browser proof → final certification chain

Always Free eligibility depends on OCI account state, home region, and remaining free capacity. Verify the Apply plan before creating resources.
