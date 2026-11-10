# TGG App

TGG-owned application configuration layer.

## Included
- Next.js application configuration
- Prisma database singleton
- secure environment-variable template
- Unreal Enhanced Input mappings
- bridges to TGG Source, TGG Projects, and TGG Higgsfield

## Playable slice (Act I)
`/play` is a touch-first DOM implementation of all 12 screens and the Act I loop
(`hq` → `drive-to-studio` → `produce-master` → `deliver-to-vault` → `complete`).
State lives in one reducer, persists to `localStorage`, and exposes `DEMO` / `SIM`
badges wherever a value is not measured. No screen awards CR, REP, XP or royalties.

```bash
npm install
npm run dev -- -H 0.0.0.0 -p 3000   # open http://<your-LAN-IP>:3000/play on the phone
npm run check                        # tsc --noEmit
```

Screens are reachable directly by hash: `#s01` … `#s12`.

## Security
Production secrets are intentionally not stored in this repository. Use the TGG runtime/secret layer for real credentials.

## Steam images
Steam-hosted avatar/media images are allowed through HTTPS `steamstatic.com` remote image patterns.
