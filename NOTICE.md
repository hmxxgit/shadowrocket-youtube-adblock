# Third-party notices and modifications

This distribution includes software from [Maasea/sgmodule](https://github.com/Maasea/sgmodule), licensed under Apache License 2.0 (`LICENSE`). Copyright and credit remain with Maasea and its contributors. The bundles include Protobuf and text-encoding support. The local UMP bundle also includes noble-ciphers, noble-hashes and fflate; their MIT licenses are reproduced in `THIRD_PARTY_LICENSES.md`, and original inline license notices are retained.

## Pinned upstream files

Checked 2026-10-29: latest upstream revision remains `65075cdb388fc5e3094afd7e7314c67b243f3525`, dated 2026-07-19. Latest upstream uses a third-party Worker; this project does not use that redirection.

| Vendored file | Upstream revision | SHA-256 |
| --- | --- | --- |
| `vendor/youtube.response.upstream.js` | `65075cdb388fc5e3094afd7e7314c67b243f3525` | `f98483d5f5017514f82502253c0db5ce2d4ffb7839887aa2cadc22666f5a7f12` |
| `vendor/youtube.request.upstream.js` | `2ead6ff5950d7722c4aa6658998904ef78eee531` | `add9d94d712367b929b42a804bc1bf8e42542021e6f6f5e8f412c287c8ef7010` |
| `vendor/youtube.ump.upstream.js` | `2ead6ff5950d7722c4aa6658998904ef78eee531` | `0694f1ec6ae1cd3406b8032777dbefaa1dc7a30bbb51f5c9de42cda4d5b246d4` |

Original files are under `Script/Youtube/` at these revisions. The older request/UMP files are deliberately pinned to the last local-processing implementation, before the July 12 Worker migration. The current Protobuf processing code is embedded in the UMP artifact so both playback paths use the same transforms.

## Changes, 2026-10-29

`tools/build.py` verifies all input hashes, applies exact patches, and generates three self-contained scripts. See `CHANGELOG.md` for release-specific behavior. Changes include safer endpoint dispatch, isolated device storage, binary normalization, background/PiP flags preserving existing unknown fields, background-only account settings, per-item ad inspection, and local UMP processing with frame bounds and compression checks. Caption rewriting is disabled. No guide changes or download enablement are registered.

The request script no longer returns empty media or redirects. Failed UMP decoding returns the original response and invalidates its cached key to allow subsequent refresh. Keys remain in Shadowrocket's device-local persistent storage. Scripts do not send requests to any third-party processing service.

## Primary sources consulted

- [Maasea current module](https://github.com/Maasea/sgmodule/blob/65075cdb388fc5e3094afd7e7314c67b243f3525/YouTube.Enhance.sgmodule)
- [Maasea local UMP implementation](https://github.com/Maasea/sgmodule/blob/2ead6ff5950d7722c4aa6658998904ef78eee531/Script/Youtube/youtube.ump.js)
- [Maasea Shadowrocket/playback compatibility reports](https://github.com/Maasea/sgmodule/issues/108). Upstream tests Surge and does not guarantee other clients.
- [app2smile Protobuf feed filter](https://github.com/app2smile/rules/blob/1f3aae53152571e7b7d7d3e015256447ab41dc21/js/youtube.js) (MIT). `tools/feed-filter.js` adapts its factual field paths and parent-card removal approach. This file dates from 2024-04-28; repository latest revision checked was `df6366a7024e0b3f0aa3510c5b791eea6f3cba89` (2026-03-04). No claim is made that every path was freshly verified against current iPhone traffic. The MIT notice is included in `THIRD_PARTY_LICENSES.md`.
- [YTLite iOS feed filtering](https://github.com/dayanch96/YTLite/blob/2e2925c7b9c0ef321635a0274c0b5ac238a153be/YTLite.x), latest revision checked 2026-10-17. Its Element compatibility/ad logging and section-level removal corroborate the need to identify whole card containers. Only layout-name/schema facts are referenced; no tweak code is bundled. This Shadowrocket module does not hook the App or guess unknown compatibility-options field numbers.

Local tests use synthetic fixtures. Neither upstream maintenance nor passing these tests establishes successful filtering/background playback on the user's iPhone.

## 1.2.0 feed-specific adaptation

`tools/feed-filter.js` runs a bounded, wire-preserving visitor before the fixed generated feed schema, using only exact renderer/metadata paths and explicit ad layouts. It prunes repeated list members and newly emptied known parent renderers. Unchanged fields and repeated messages keep their raw bytes. The same visitor runs before UMP/get_watch processing; account/PiP/background logic stays as in 1.1.0. Raw title/URL substring heuristics are retired. All test fixtures are synthetic and contain no captured user information. Runtime diagnostics remain local and contain only endpoint names, counts and fixed status messages.

## 1.3.0 diagnostic audit

No upstream protocol fields or interception hosts were added. Device-local cache invalidation is now limited to evidence implicating keys; diagnostic logs use enums and booleans only and are disabled by default. The adapter suppresses legacy bundle console calls and avoids passing the new simple diagnostic argument through upstream's JSON options parser. `DIAGNOSTICS.md` distinguishes static configuration/cryptographic fixture checks from unavailable iPhone runtime evidence. Immutable script revision references are recorded in `release.json`.

Configuration references: [Shadowrocket community manual](https://github.com/LOWERTOP/Shadowrocket/wiki) (module MITM append, configuration recompilation/remote scripts), [published upstream binary script configuration](https://github.com/Maasea/sgmodule/blob/65075cdb388fc5e3094afd7e7314c67b243f3525/YouTube.Enhance.sgmodule), and [logical-rule examples](https://github.com/GMOogway/shadowrocket-rules/blob/master/docs/01.shadowrocket_configure.md). These are public configuration references, not an iPhone parser or guarantees about the user's App traffic.
