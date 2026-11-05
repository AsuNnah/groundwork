# Platform notes: <target>

Copy the facts from `groundwork/packs/<target>.json` and the current store or OS rules. Re-check before each release (P9, P10).

## Support range
- Minimum OS / browser / API level: <e.g. Android minSdk 24, targetSdk per pack policy>
- Architectures: <arm64, x86_64, …>
- Form factors: <phone, tablet, desktop, TV>

## Permissions
| Permission | Why the app needs it (user-facing text) | Asked when | Works without it? |
|---|---|---|---|

## Signing and identity
- Bundle / package id:
- Signing key or certificate: where it lives (name only, never the secret), who can access it, backup
- Notarisation / code signing steps:

## Store or distribution rules
- Store: <Play / App Store / Microsoft Store / Flathub / npm / none>
- Policy deadlines from the pack `policies` (target API, SDK minimum):
- Privacy label / data-safety form: what data is collected, linked, shared (match the SRD)
- Review risks: <payments, login requirements, background location…>

## Release tier
Minimum test tier for this target (pack `min_release_tier`) and where it runs: <S2 local emulator / S3 CI>.
