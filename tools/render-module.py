from pathlib import Path
import re, sys, json, hashlib
owner=sys.argv[1]
assert re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9-]*',owner)
root=Path(__file__).resolve().parent.parent
version=json.loads((root/'package.json').read_text())['version']
script_ref=json.loads((root/'release.json').read_text())['script_ref']
assert script_ref=='main' or re.fullmatch(r'[0-9a-f]{40}',script_ref)
source=(root/'vendor/yfamilys.YouTubeAd.sgmodule').read_text()
meta=json.loads((root/'vendor/compatibility-baseline.json').read_text())
assert hashlib.sha256((root/'vendor/yfamilys.YouTubeAd.sgmodule').read_bytes()).hexdigest()==meta['module_sha256']
# Copy rule behavior and MITM scope from the captured compatibility baseline.
rules=source.split('[Rule]\n',1)[1].split('[URL Rewrite]',1)[0].strip()
rewrites=source.split('[URL Rewrite]\n',1)[1].split('[Script]',1)[0].strip()
mitm=source.split('[MITM]\n',1)[1].strip()
pattern=source.split('[Script]\n',1)[1].split('[MITM]',1)[0].split('pattern=',1)[1].split(',requires-body=',1)[0]
base=f'https://raw.githubusercontent.com/{owner}/shadowrocket-youtube-adblock/{script_ref}'
module=f'''#!name=YouTube Adblock
#!desc=Maasea 基准兼容模式；oad 空响应；Protobuf 去广告/后台/PiP；不同时启用 UMP。
#!version={version}
#!author=Maasea; compatibility adaptation: hmxxgit
# Sources, original licenses and exact snapshot: NOTICE.md and vendor/
# Script revision: {script_ref}; diagnostic=false by default.
# Disable other YouTube modules; do not combine this profile with UMP interception.

[Rule]
{rules}

[URL Rewrite]
{rewrites}

[Script]
youtube.adblock.response = type=http-response,pattern={pattern},requires-body=1,max-size=-1,binary-body-mode=1,engine=auto,timeout=60,argument=diagnostic=false,script-path={base}/scripts/youtube.response.compat.js?v={version}

[MITM]
{mitm}
'''
(root/'youtube-adblock.module').write_text(module)
diagnostic=module.replace('#!name=YouTube Adblock\n','#!name=YouTube Adblock Diagnostic\n').replace('argument=diagnostic=false','argument=diagnostic=true').replace('diagnostic=false by default.','Temporary diagnostic mode enabled; disable the normal module first.')
(root/'youtube-adblock-diagnostic.module').write_text(diagnostic)
