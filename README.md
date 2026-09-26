# TGG OCI Production Stack

[![Deploy to Oracle Cloud](https://oci-resourcemanager-plugin.plugins.oci.oraclecloud.com/latest/deploy-to-oracle-cloud.svg)](https://cloud.oracle.com/resourcemanager/stacks/create?zipUrl=https://github.com/tggm803sc/tggm/archive/refs/heads/oci-stack-v1.zip)

This branch contains only the OCI Resource Manager Terraform configuration at repository root.

Pinned source:
- Canonical repo: `tggm803sc/tggm`
- OCI stack branch: `oci-stack-v1`
- Certification candidate SHA: `b36596a996558d53daa5ded3e62f2599417cb0e1b87761e8895a908ed915ebd3`
- Control-plane bootstrap commit: `7c971ec44be0daf00d81807f588db264239f5fe4`

Required Oracle inputs:
- tenancy OCID
- compartment OCID
- region
- administrator CIDR (prefer a /32)

Defaults keep the optional x86 Unreal game node OFF.

After Apply:
1. capture Terraform outputs,
2. run `consume-apply-output.py`,
3. verify with `verify-apply-handoff.py`,
4. point DNS at the control public IP,
5. run `finalize-host-agent.sh`,
6. run the TGG live-readiness gate.

R232 is not executed by this stack.
