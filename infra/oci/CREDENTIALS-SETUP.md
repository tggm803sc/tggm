# TGG OCI Credential Setup

Current state:
- Terraform validate: PASS
- Terraform plan: blocked only because OCI credentials are absent from GitHub Actions
- OCI Resource Manager Apply: NOT RUN
- R232: NOT EXECUTED

## GitHub Actions secrets for PLAN ONLY

Add these repository secrets in GitHub:

- `OCI_TENANCY_OCID`
- `OCI_COMPARTMENT_OCID`
- `OCI_REGION`
- `OCI_ADMIN_CIDR`
- `OCI_USER_OCID`
- `OCI_FINGERPRINT`
- `OCI_PRIVATE_KEY`

Optional:
- `OCI_SSH_PUBLIC_KEY`

Do not commit any of these values into the repository.

The workflow `.github/workflows/tgg-oci-terraform-plan.yml` is plan-only. It contains no Terraform Apply command.

## Meaning of each value

- `OCI_TENANCY_OCID`: tenancy OCID.
- `OCI_COMPARTMENT_OCID`: compartment where TGG resources will live.
- `OCI_REGION`: OCI region identifier.
- `OCI_ADMIN_CIDR`: administrator source CIDR. Prefer a single public IP as `x.x.x.x/32`. The Terraform stack rejects `0.0.0.0/0` and `::/0`.
- `OCI_USER_OCID`: OCI IAM user OCID for API-key authentication.
- `OCI_FINGERPRINT`: fingerprint of the OCI API public key.
- `OCI_PRIVATE_KEY`: PEM private key corresponding to that fingerprint.
- `OCI_SSH_PUBLIC_KEY`: optional public key for VM SSH login.

## Security boundary

The GitHub plan workflow:
- can read OCI metadata required by the Terraform provider;
- can calculate the proposed infrastructure changes;
- cannot Apply because the workflow has no Apply step;
- does not provision `TGG_REMOTE_TOKEN`;
- does not execute R232.

## Resource Manager alternative

If you do not want OCI API credentials in GitHub, use the one-click Oracle Resource Manager stack instead. That path uses the logged-in Oracle session and the root-only `oci-stack-v1` branch.

After a successful plan or Resource Manager Apply, continue only through the existing TGG evidence chain.
