// Apache-2.0. Local fallback used by Maasea's initplayback implementation.
// Only acknowledged /initplayback requests are intercepted. Media streams pass through.
(function () {
  try {
    if (!/^https:\/\/[\w-]+\.googlevideo\.com\/initplayback\?(?:[^#]*&)?ack(?:=[^&#]*)?(?:&|$)/.test($request.url)) {
      $done({});
      return;
    }
    // Empty initialization response asks supported clients to retry via v1/player.
    // This behavior is version-dependent; no universal playback guarantee is made.
    $done({ response: { status: 200, headers: { 'Content-Type': 'text/plain' }, body: new Uint8Array(0) } });
  } catch (error) {
    console.log('YouTube Adblock init: ' + String(error));
    $done({});
  }
})();
