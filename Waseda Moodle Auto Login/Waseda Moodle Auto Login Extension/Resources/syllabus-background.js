"use strict";

let credentialQueue = Promise.resolve();

async function nativeCredentials(action, password) {
  const request = { type: "campus-sso:credentials-native", action };
  if (password !== undefined) request.password = password;
  const result = await browser.runtime.sendNativeMessage("jp.yuto.campusssohelper", request);
  if (!result?.ok) throw new Error(result?.error || "Keychainを利用できません。端末のロックを解除して再度お試しください。");
  return result;
}

async function handleCredentials(message, sender) {
  const sourceURL = sender?.url || sender?.tab?.url;
  let source;
  try { source = new URL(sourceURL); } catch (_) { /* Reject below. */ }
  const popup = sourceURL === browser.runtime.getURL("popup/popup.html");
  const microsoft = source?.origin === "https://login.microsoftonline.com";
  const moodle = source?.origin === "https://wsdmoodle.waseda.jp";
  if (sender?.id && sender.id !== browser.runtime.id || !popup && !microsoft && !moodle ||
      ["save", "clear"].includes(message.action) && !popup || message.action === "login" && !microsoft ||
      !["status", "save", "login", "clear"].includes(message.action)) {
    return { ok: false, error: "許可されていない資格情報の要求です。" };
  }
  try {
    if (message.action === "clear") {
      await nativeCredentials("remove");
      await browser.storage.local.remove(["password", "enabled", "userId", "flowStartedAt"]);
      return { ok: true };
    }
    const settings = await browser.storage.local.get(["enabled", "userId", "flowStartedAt"]);
    if (message.action === "login") {
      const started = Number(settings.flowStartedAt);
      const elapsed = Date.now() - started;
      if (!settings.enabled || !settings.userId || !Number.isFinite(started) || started <= 0 ||
          elapsed < 0 || elapsed > 120000) {
        return { ok: false, error: "有効なログイン操作がありません。" };
      }
    }
    // Delete the legacy value only after the native store confirms the migration.
    const legacy = await browser.storage.local.get("password");
    if (typeof legacy.password === "string" && legacy.password) {
      await nativeCredentials("migrate", legacy.password);
      await browser.storage.local.remove("password");
    }
    if (message.action === "login") return nativeCredentials("get");
    let result = await nativeCredentials("status");
    if (message.action === "save") {
      if (typeof message.userId !== "string" || message.userId.length > 254 ||
          typeof message.enabled !== "boolean" || typeof message.password !== "string" ||
          message.password.length > 4096) {
        return { ok: false, error: "入力内容を確認してください。" };
      }
      const userId = message.userId.trim();
      if (result.hasPassword && userId !== (settings.userId ?? "") && !message.password) {
        return { ok: false, error: "メールアドレスを変更するときはパスワードも入力してください。" };
      }
      if (message.enabled && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userId) || !message.password && !result.hasPassword)) {
        return { ok: false, error: "メールアドレスとパスワードを入力してください。" };
      }
      if (message.password) result = await nativeCredentials("set", message.password);
      await browser.storage.local.set({ enabled: message.enabled, userId });
      return { ok: true, hasPassword: Boolean(result.hasPassword), userId, enabled: message.enabled };
    }
    return { ok: true, hasPassword: Boolean(result.hasPassword), userId: settings.userId ?? "",
      enabled: Boolean(settings.enabled), flowStartedAt: settings.flowStartedAt };
  } catch (_) {
    return { ok: false, error: "Keychainを利用できません。端末のロックを解除し，Safariを再読み込みしてください。" };
  }
}

// The content script can read Moodle's DOM, while the extension background has
// the host permission needed to request Waseda's separate syllabus origin.
browser.runtime.onMessage.addListener(async (message, sender) => {
  if (message?.type === "campus-sso:credentials") {
    const result = credentialQueue.then(() => handleCredentials(message, sender));
    credentialQueue = result.catch(() => undefined);
    return result;
  }
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

  let response;
  try {
    response = await fetch(url.href, options);
  } catch (error) {
    // Safari on iPhone can reject extension-background requests even when the
    // syllabus page itself opens normally. The containing app can fetch it.
    try {
      const request = {
        type: "campus-sso:syllabus-native",
        path: `${url.pathname}${url.search}`,
      };
      if (message.fields) request.fields = message.fields;
      const native = await browser.runtime.sendNativeMessage("jp.yuto.campusssohelper", request);
      if (native?.ok && typeof native.html === "string") return { ...native, transport: "native" };
      return { ok: false, error: `シラバスを取得できませんでした: ${error.message}。代替取得: ${native?.error || "応答なし"}` };
    } catch (nativeError) {
      return { ok: false, error: `シラバスを取得できませんでした: ${error.message}。代替取得: ${nativeError.message}` };
    }
  }
  if (!response.ok) return { ok: false, error: `シラバスの応答: HTTP ${response.status}` };
  return { ok: true, html: await response.text(), transport: "web" };
});
