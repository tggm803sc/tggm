# TGG OCI Apply — One-Click Path

Oracle Resource Manager supports a Deploy-to-Oracle-Cloud button backed by a public Terraform ZIP.

Use the TGG root-only stack:

- Branch: `oci-stack-v1`
- Branch commit: `b840e555402eaa16611e4a6b0ea32f3fc6f43b70`
- Terraform files: repository root
- Public ZIP: `https://github.com/tggm803sc/tggm/archive/refs/heads/oci-stack-v1.zip`

## Deploy

[![Deploy to Oracle Cloud](https://oci-resourcemanager-plugin.plugins.oci.oraclecloud.com/latest/deploy-to-oracle-cloud.svg)](https://cloud.oracle.com/resourcemanager/stacks/create?zipUrl=https://github.com/tggm803sc/tggm/archive/refs/heads/oci-stack-v1.zip)

Required Oracle inputs:
- tenancy OCID
- compartment OCID
- region
- administrator CIDR, preferably your current public IP as `/32`

Keep the optional x86 Unreal node OFF unless intentionally enabling a paid node.

After Apply:
1. capture Terraform outputs,
2. run the output bridge,
3. point DNS to the control public IP,
4. run the Host Agent HTTPS finalizer,
5. run TGG live readiness,
6. continue the V21 pre-R232 chain.

This path does not execute R232.
