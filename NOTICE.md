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

## 1.3.1 evidence-based repair

The exact reported initplayback/oad rejection was present in this repository's v1.0 commit `f66c322` and removed in v1.1 (`5383974`). Current modules are regression-tested not to reject those requests. No external configuration is modified. All vendored runtime getJSON adapters now delegate to `tools/cache.js`, isolating malformed JSON, invalid root/record types and persistent-store failures. Repairs affect only this project's cache keys and never log raw data. Upstream parameter JSON parsing remains disabled and binary responses still use fromBinary; codec fromJsonString methods are not used on the live response path. Real-device log excerpts identify a reproducible failure class but do not prove which cache key caused it or that advertisements are now removed.

## 1.4.0 compatibility baseline

The user identified https://yfamilys.com/module/YouTubeAd.sgmodule as working on their iPhone. The exact retrieved configuration is preserved in `vendor/yfamilys.YouTubeAd.sgmodule`; `vendor/compatibility-baseline.json` records SHA-256, date and provenance. This snapshot credits Maasea. The referenced response URL returned exactly the existing Apache-2.0 vendored Maasea bundle at commit `65075cdb388fc5e3094afd7e7314c67b243f3525`; no upstream script license or copyright is removed. The snapshot is an attributed compatibility reference, not a claim of authorship over the mirror. Its icon/homepage URLs are not carried into runtime configuration.

Default configuration now loads only `scripts/youtube.response.compat.js`. It uses that reviewed response bundle with limited adaptation: guarded cache reading, default-off safe diagnostics, missing-playability guard, safe endpoint dispatch, fixed options and retention of ordinary Shorts instead of blanket Shorts layout hiding. Original Protobuf advertising, background/PiP and settings behavior is otherwise retained. No new fields are invented. Default routing, all five rewrite lines and the MITM list are generated from the captured reference. The oad response is `reject-200`, excluding videoplayback/dclk paths; this differs from the old v1.0 network rejection.

Old local UMP/request/feed scripts remain as historical assets with their prior license notices, but neither normal nor diagnostic module registers them. This removes default conflict between oad interception and UMP decryption. All runtime script references point to this repository's immutable revision. No third-party Worker, translation request or telemetry is enabled. Golden tests compare typical player/get_watch/Shorts outputs with the unmodified pinned upstream, and request behavior with the captured configuration. They do not establish new iPhone success or reveal which mutable upstream bytes the user's earlier device cached.

## 1.5.0 playback startup optimization

No upstream protocol fields, sensitive telemetry or interception hosts were added. The reference-derived rewrites now deliberately exclude initplayback, preserving its original request instead of empty-200 / 302 responses. Existing advertisement field removal is retained; player/get_watch handlers only encode actual changes and merge existing PiP/background abilities. Timing is opt-in and bounded. Request/response probes perform no network fetches or body/header modifications. They use a platform request id only to derive opaque local correlation keys; no original id, URL, headers or body is persisted. Missing/ambiguous association produces null rather than a fabricated network duration.

The explicit JSC selection avoids relying on auto runtime selection, but no iPhone cold-start gain is measured here. The [Shadowrocket News release notes](https://t.me/s/ShadowrocketNews/328) mention the request-id API, and the [Shadowrocket community manual](https://github.com/LOWERTOP/Shadowrocket/wiki) documents engine selection. Runtime API availability and matching IDs are feature-detected, not assumed from those references. Default registration still contains no UMP processor. The reported 10-second device delay has no new timing trace establishing its principal cause.

## 1.5.1 upstream cleanup integrity

The default compatibility artifact now retains vendor Ni and Br verbatim. Caller-side diagnostics/change detection preserve the no-op encoding fast path; Si retains the documented idempotent optimization. A synthetic v1.4 reproduction demonstrates that the old custom advertisement whitelist can bypass an upstream-recognizable card, so this profile uses a distinct, guarded local cache namespace without deleting old entries. This does not establish the contents of the user's iPhone cache. Safe upstream parameter reading is restored only in this profile. The original oad rewrite is restored; ctier's startup exclusion remains an explicit difference from the mirror baseline. No UMP processing, external service, sensitive logging or extra interception scope is introduced. See AD_FILTER_AUDIT.md for evidence and limits.
