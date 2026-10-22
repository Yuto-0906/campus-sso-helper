const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../extension/syllabus-background.js"), "utf8");

function listenerWith(fetch, sendNativeMessage) {
  let listener;
  const browser = { runtime: {
    onMessage: { addListener(callback) { listener = callback; } },
    sendNativeMessage,
  } };
  vm.runInNewContext(source, { browser, fetch, URL, FormData }, { filename: "syllabus-background.js" });
  return listener;
}

const sender = { url: "https://wsdmoodle.waseda.jp/my/" };

test("Safariの通信失敗時だけネイティブ取得へ切り替える", async () => {
  let nativeRequest;
  const listener = listenerWith(
    async () => { throw new Error("Load failed"); },
    async (appId, request) => {
      nativeRequest = { appId, request };
      return { ok: true, html: "<html>syllabus</html>" };
    },
  );
  const response = await listener({
    type: "campus-sso:syllabus-request", path: "/syllabus/JAA102.php",
  }, sender);
  assert.equal(response.ok, true);
  assert.equal(response.html, "<html>syllabus</html>");
  assert.equal(nativeRequest.appId, "jp.yuto.campusssohelper");
  assert.equal(nativeRequest.request.path, "/syllabus/JAA102.php");
  assert.equal(Object.hasOwn(nativeRequest.request, "fields"), false);
  assert.equal(response.transport, "native");
});

test("許可外のURLはネイティブ側にも転送しない", async () => {
  let called = false;
  const listener = listenerWith(
    async () => { called = true; throw new Error("Load failed"); },
    async () => { called = true; return { ok: true, html: "" }; },
  );
  const response = await listener({
    type: "campus-sso:syllabus-request", path: "https://example.com/syllabus/JAA102.php",
  }, sender);
  assert.equal(response.ok, false);
  assert.equal(called, false);
});

test("HTTPエラーではネイティブ取得を実行しない", async () => {
  let called = false;
  const listener = listenerWith(
    async () => ({ ok: false, status: 503 }),
    async () => { called = true; return { ok: true, html: "" }; },
  );
  const response = await listener({
    type: "campus-sso:syllabus-request", path: "/syllabus/JAA102.php",
  }, sender);
  assert.match(response.error, /HTTP 503/);
  assert.equal(called, false);
});
