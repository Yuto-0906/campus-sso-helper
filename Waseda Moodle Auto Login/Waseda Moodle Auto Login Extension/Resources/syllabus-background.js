"use strict";

// The content script can read Moodle's DOM, while the extension background has
// the host permission needed to request Waseda's separate syllabus origin.
browser.runtime.onMessage.addListener(async (message, sender) => {
  if (message?.type !== "campus-sso:syllabus-request") return undefined;
  const sourceURL = sender?.url || sender?.tab?.url;
  let source;
  try { source = new URL(sourceURL); } catch (_) { /* Reject below. */ }
  if (source?.origin !== "https://wsdmoodle.waseda.jp") {
    return { ok: false, error: "許可されていないページからの要求です。" };
  }

  if (typeof message.path !== "string") return { ok: false, error: "URLが正しくありません。" };
  let url;
  try { url = new URL(message.path, "https://www.wsl.waseda.jp"); } catch (_) {
    return { ok: false, error: "URLが正しくありません。" };
  }
  const allowedPaths = new Set(["/syllabus/index.php", "/syllabus/JAA102.php", "/syllabus/JAA104.php"]);
  if (url.origin !== "https://www.wsl.waseda.jp" || !allowedPaths.has(url.pathname)) {
    return { ok: false, error: "許可されていないシラバスURLです。" };
  }

  try {
    const options = { credentials: "include", redirect: "follow" };
    if (message.fields && url.pathname === "/syllabus/index.php") {
      const form = new FormData();
      for (const pair of message.fields) {
        if (!Array.isArray(pair) || pair.length !== 2 ||
            typeof pair[0] !== "string" || typeof pair[1] !== "string") {
          return { ok: false, error: "検索条件が正しくありません。" };
        }
        form.append(pair[0], pair[1]);
      }
      options.method = "POST";
      options.body = form;
    }
    const response = await fetch(url.href, options);
    if (!response.ok) return { ok: false, error: `シラバスの応答: HTTP ${response.status}` };
    return { ok: true, html: await response.text() };
  } catch (error) {
    return { ok: false, error: `シラバスを取得できませんでした: ${error.message}` };
  }
});
