from pathlib import Path
import re, sys
owner = sys.argv[1]
assert re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9-]*', owner)
base = f'https://raw.githubusercontent.com/{owner}/shadowrocket-youtube-adblock/main'
module = r'''#!name=YouTube Adblock
#!desc=iOS YouTube 官方 App 去广告；本地 Protobuf 重写；保留 Shorts；兼容性随 App 版本变化。
#!version=1.0.0
# Apache-2.0; Maasea/sgmodule attribution and modifications: NOTICE.md
# Refresh this remote module AND its remote scripts after updates.

[Rule]
# Force TCP only for the YouTube API and media hosts so MITM can inspect HTTPS.
AND,((DOMAIN,youtubei.googleapis.com),(PROTOCOL,UDP)),REJECT
AND,((DOMAIN,youtubei-att.googleapis.com),(PROTOCOL,UDP)),REJECT
AND,((DOMAIN-SUFFIX,googlevideo.com),(PROTOCOL,UDP)),REJECT

[URL Rewrite]
# Only explicit ad endpoints. Never reject /videoplayback or the entire media CDN.
^https:\/\/[\w-]+\.googlevideo\.com\/initplayback\?(?:[^#]*&)?oad(?:=[^&#]*)?(?:&|$) - reject
^https:\/\/[\w-]+\.googlevideo\.com\/dclk_video_ads(?:[/?]|$) - reject

[Script]
youtube.adblock.response = type=http-response,pattern=^https:\/\/youtubei(?:-att)?\.googleapis\.com\/youtubei\/v1\/(browse|next|player|search|reel\/reel_watch_sequence|get_watch)(?:\?[^#]*)?$,requires-body=1,binary-body-mode=1,max-size=0,timeout=30,script-path=BASE/scripts/youtube.response.js
youtube.adblock.init = type=http-request,pattern=^https:\/\/[\w-]+\.googlevideo\.com\/initplayback\?(?:[^#]*&)?ack(?:=[^&#]*)?(?:&|$),timeout=10,script-path=BASE/scripts/youtube.request.js

[MITM]
hostname = %APPEND% youtubei.googleapis.com, youtubei-att.googleapis.com, *.googlevideo.com
'''
(Path(__file__).resolve().parent.parent / 'youtube-adblock.module').write_text(module.replace('BASE', base))
