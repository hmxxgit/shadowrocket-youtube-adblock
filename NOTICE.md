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
- [app2smile Protobuf feed module](https://github.com/app2smile/rules/blob/master/module/youtube.sgmodule). Its scope explicitly excludes video ad breaks; no code copied.

Local tests use synthetic fixtures. Neither upstream maintenance nor passing these tests establishes successful filtering/background playback on the user's iPhone.
