# TGG Source

TGG Source is the TGG-owned source-control service.

Current foundation:
- repository creation/listing
- Git-backed repositories
- branches
- commit history
- tree/file reads
- multi-file commits
- health endpoint
- TGG web dashboard

Default storage: `/data/tgg-source/repos`
Default port: `10030`

This is the beginning of the TGG replacement for the GitHub product experience. It is intentionally TGG-owned and can later add accounts, permissions, pull requests, issues, releases, packages, code review, webhooks, Actions-equivalent TGG Workflows, search, and artifact storage.
