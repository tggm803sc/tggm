# TGG OCI Resource Manager — Plan First

Oracle Resource Manager supports creating a stack from a Terraform ZIP and optionally running Apply during stack creation.

For TGG, do **not** select automatic Apply during stack creation.

## Required production sequence

1. Open the TGG Deploy-to-Oracle-Cloud stack.
2. Sign in to OCI.
3. Select the target compartment.
4. Select a Terraform version compatible with the validated TGG stack.
5. Review variables.
6. Keep **Run apply** OFF while creating the stack.
7. Create the stack.
8. Run a **Plan** job.
9. Review the plan for:
   - one control VCN;
   - one public control subnet;
   - one runtime subnet;
   - control VM shape `VM.Standard.A1.Flex`;
   - optional x86 game node disabled unless intentionally enabled;
   - no public TCP 8787 ingress;
   - administrator-only TCP 22/8000/6001/6002;
   - public HTTP/HTTPS 80/443;
   - candidate SHA `b36596a996558d53daa5ded3e62f2599417cb0e1b87761e8895a908ed915ebd3`;
   - control-plane commit `7c971ec44be0daf00d81807f588db264239f5fe4`.
10. Apply only after the plan matches this contract.
11. Export Terraform outputs and continue the existing TGG OCI handoff.
12. R232 remains blocked until the full live evidence chain passes.

## Fail closed

Do not Apply if the plan:
- enables the paid game node unexpectedly;
- opens TCP 8787 publicly;
- broadens administrator access to `0.0.0.0/0` or `::/0`;
- changes the pinned candidate SHA;
- changes the pinned control-plane commit;
- adds an unexpected provider, resource type, or public endpoint.

This runbook does not execute Apply.
