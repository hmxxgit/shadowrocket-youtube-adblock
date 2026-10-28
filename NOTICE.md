# Third-party notices and changes

This distribution includes software from [Maasea/sgmodule](https://github.com/Maasea/sgmodule), distributed under Apache License 2.0 (included as `LICENSE`). Copyright and credit remain with Maasea and the original contributors. The upstream bundle contains its Protobuf runtime and text-encoding support.

- Upstream revision: `65075cdb388fc5e3094afd7e7314c67b243f3525` (2026-07-19; latest repository commit checked on 2026-10-29).
- Original file: `Script/Youtube/youtube.response.js`.
- Unmodified copy: `vendor/youtube.response.upstream.js`.
- SHA-256: `f98483d5f5017514f82502253c0db5ce2d4ffb7839887aa2cadc22666f5a7f12`.
- Original source: https://raw.githubusercontent.com/Maasea/sgmodule/65075cdb388fc5e3094afd7e7314c67b243f3525/Script/Youtube/youtube.response.js

Modifications (2026-10-29): reproducible adaptation in `tools/build.py`; remove PiP/background playback and subtitle modifications from the player handler; retain normal Shorts layouts; match dispatch by exact endpoint rather than query substrings; handle absent User-Agent; isolate storage keys; normalize ArrayBuffer bodies; pass through unsupported/malformed responses and guard completion. The module does not register the upstream guide, settings, config or log-event handlers.

`scripts/youtube.request.js` implements the empty-init fallback branch found in the upstream request script, without its third-party Cloudflare Worker redirection or key transfer. Only `/initplayback` requests with an `ack` parameter are handled. This deliberately trades encrypted UMP processing for a version-dependent client fallback to the player API; it may be ineffective on some YouTube versions. No successful real-device validation is claimed.

Additional primary references reviewed:

- [app2smile/rules](https://github.com/app2smile/rules/blob/master/module/youtube.sgmodule): Protobuf response rewriting for home and next feeds; its own description explicitly excludes video ad breaks. No code copied from this project.
- [Maasea module](https://github.com/Maasea/sgmodule/blob/master/YouTube.Enhance.sgmodule): binary response settings and initplayback handling.
- [Upstream compatibility reports](https://github.com/Maasea/sgmodule/issues/108): Shadowrocket and playback behavior vary by App version. Upstream explicitly tests Surge and does not guarantee other clients.
