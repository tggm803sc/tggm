# TGG App

TGG-owned application configuration layer.

## Included
- Next.js application configuration
- Prisma database singleton
- secure environment-variable template
- Unreal Enhanced Input mappings
- bridges to TGG Source, TGG Projects, and TGG Higgsfield

## Security
Production secrets are intentionally not stored in this repository. Use the TGG runtime/secret layer for real credentials.

## Steam images
Steam-hosted avatar/media images are allowed through HTTPS `steamstatic.com` remote image patterns.
