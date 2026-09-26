# TGG OCI Apply Handoff

The code-side OCI preparation is complete.

Use Oracle Cloud Resource Manager with:

- Repository: `https://github.com/tggm803sc/tggm.git`
- Branch: `oci-production-v1`
- Working directory: `infra/oci`
- Frozen commit: `7d4b0f0d8cbc72f4f89cf1515c3bf30be9171748`

Required values in Oracle:
- tenancy OCID
- compartment OCID
- OCI region
- administrator CIDR, preferably your current public IP as `/32`

Keep the optional Unreal x86 game node OFF unless explicitly choosing a paid node.

After Apply, export the Terraform outputs as JSON and pass them through:

`python3 infra/oci/consume-apply-output.py --terraform-output <outputs.json> --out-dir <state-dir>`

Then verify:

`python3 infra/oci/verify-apply-handoff.py --handoff <state-dir>/OCI_APPLY_HANDOFF.json`

After DNS points at the new control-node public IP, run the Host Agent HTTPS finalizer on the control node and then run:

`npm run check:tgg-live-readiness`

This handoff does not execute R232.
