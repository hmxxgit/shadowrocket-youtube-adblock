from pathlib import Path
import re, sys, json
owner = sys.argv[1]
assert re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9-]*', owner)
root=Path(__file__).resolve().parent.parent
version=json.loads((root/'package.json').read_text())['version']
script_ref=json.loads((root/'release.json').read_text())['script_ref']
assert script_ref=='main' or re.fullmatch(r'[0-9a-f]{40}',script_ref)
base=f'https://raw.githubusercontent.com/{owner}/shadowrocket-youtube-adblock/{script_ref}'
module = r'''#!name=YouTube Adblock
#!desc=iOS YouTube 官方 App 去广告；本地 Protobuf/UMP 重写；尝试后台播放；保留 Shorts；兼容性随 App 版本变化。
#!version=VERSION
# Apache-2.0; Maasea/sgmodule attribution and modifications: NOTICE.md
# Refresh this remote module AND its remote scripts after updates.

[Rule]
# Force TCP only for the YouTube API and media hosts so MITM can inspect HTTPS.
AND,((DOMAIN,youtubei.googleapis.com),(PROTOCOL,UDP)),REJECT
AND,((DOMAIN,youtubei-att.googleapis.com),(PROTOCOL,UDP)),REJECT
AND,((DOMAIN-SUFFIX,googlevideo.com),(PROTOCOL,UDP)),REJECT

[URL Rewrite]
# Only explicit ad endpoints. Never reject /videoplayback or the entire media CDN.
^https:\/\/[\w-]+\.googlevideo\.com\/dclk_video_ads(?:[/?]|$) - reject

[Script]
youtube.adblock.response = type=http-response,pattern=^https:\/\/youtubei(?:-att)?\.googleapis\.com\/youtubei\/v1\/(browse|next|player|search|reel\/reel_watch_sequence|get_watch|config|log_event|account\/get_setting)(?:\?[^#]*)?$,requires-body=1,binary-body-mode=1,max-size=16777216,timeout=30,argument=diagnostic=false,script-path=BASE/scripts/youtube.response.js?v=VERSION
youtube.adblock.init.request = type=http-request,pattern=^https:\/\/[\w-]+\.googlevideo\.com\/initplayback\?,requires-body=1,binary-body-mode=1,max-size=16777216,timeout=30,argument=diagnostic=false,script-path=BASE/scripts/youtube.request.js?v=VERSION
youtube.adblock.log.request = type=http-request,pattern=^https:\/\/youtubei(?:-att)?\.googleapis\.com\/youtubei\/v1\/log_event(?:\?[^#]*)?$,requires-body=1,binary-body-mode=1,max-size=16777216,timeout=30,argument=diagnostic=false,script-path=BASE/scripts/youtube.request.js?v=VERSION
youtube.adblock.init.response = type=http-response,pattern=^https:\/\/[\w-]+\.googlevideo\.com\/initplayback\?,requires-body=1,binary-body-mode=1,max-size=16777216,timeout=60,argument=diagnostic=false,script-path=BASE/scripts/youtube.ump.js?v=VERSION

[MITM]
hostname = %APPEND% youtubei.googleapis.com, youtubei-att.googleapis.com, *.googlevideo.com
'''
module=module.replace('BASE',base).replace('VERSION',version)
module=module.replace('# Refresh this remote module AND its remote scripts after updates.', '# Script revision: '+script_ref+'; diagnostic=false by default. Refresh module and recompile active config.')
(root/'youtube-adblock.module').write_text(module)
diagnostic=module.replace('#!name=YouTube Adblock\n','#!name=YouTube Adblock Diagnostic\n').replace('argument=diagnostic=false','argument=diagnostic=true')
diagnostic=diagnostic.replace('diagnostic=false by default.','Temporary diagnostic mode enabled; disable the normal module first.')
(root/'youtube-adblock-diagnostic.module').write_text(diagnostic)
