const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

function fixture(initial = {}, nativeFailure = false) {
  const saved = { ...initial };
  let secret = "";
  let listener;
  const calls = [];
  const runtime = {
    id: "test-extension",
    getURL: (path) => `safari-web-extension://test/${path}`,
    onMessage: { addListener(callback) { listener = callback; } },
    async sendNativeMessage(_, request) {
      calls.push(request.action);
      if (nativeFailure) throw new Error("native unavailable");
      if (request.action === "set" || request.action === "migrate" && !secret) secret = request.password;
      if (request.action === "remove") secret = "";
      if (request.action === "get") return { ok: true, password: secret };
      return { ok: true, hasPassword: Boolean(secret) };
    },
  };
  const storage = { local: {
    async get(keys) { return Object.fromEntries((typeof keys === "string" ? [keys] : keys).map((key) => [key, saved[key]])); },
    async set(values) { Object.assign(saved, values); },
    async remove(keys) { for (const key of typeof keys === "string" ? [keys] : keys) delete saved[key]; },
  } };
  vm.runInNewContext(fs.readFileSync("extension/syllabus-background.js", "utf8"), {
    browser: { runtime, storage }, URL, FormData,
    fetch() { throw new Error("Credential operations must not use the network"); },
  });
  return { saved, calls, secret: () => secret,
    request: (action, sender, values = {}) => listener({ type: "campus-sso:credentials", action, ...values }, sender) };
}

const popup = { id: "test-extension", url: "safari-web-extension://test/popup/popup.html" };
const microsoft = { id: "test-extension", url: "https://login.microsoftonline.com/common/login" };
const moodle = { id: "test-extension", url: "https://wsdmoodle.waseda.jp/my/" };
const settings = () => ({ enabled: true, userId: "sample@example.edu", flowStartedAt: Date.now() });

test("旧パスワードはKeychain保存成功後にだけローカル領域から削除する", async () => {
  const f = fixture({ ...settings(), password: "fixture-password" });
  const response = await f.request("status", popup);
  assert.equal(response.ok, true);
  assert.equal(response.hasPassword, true);
  assert.equal(Object.hasOwn(response, "password"), false);
  assert.equal(Object.hasOwn(f.saved, "password"), false);
  assert.equal(f.secret(), "fixture-password");
});

test("移行に失敗しても既存パスワードを失わず，応答には含めない", async () => {
  const f = fixture({ ...settings(), password: "fixture-password" }, true);
  const response = await f.request("status", popup);
  assert.equal(response.ok, false);
  assert.equal(f.saved.password, "fixture-password");
  assert.ok(!JSON.stringify(response).includes("fixture-password"));
});

test("Moodleや外部ページからパスワードの取得・変更はできない", async () => {
  const f = fixture({ ...settings(), password: "fixture-password" });
  for (const [action, sender] of [["login", moodle], ["save", microsoft], ["clear", moodle],
    ["status", { url: "https://example.com" }], ["status", { ...popup, id: "other-extension" }]]) {
    assert.equal((await f.request(action, sender)).ok, false);
  }
  assert.equal(f.calls.length, 0);
});

test("Microsoftの有効なログイン中にだけKeychainのパスワードを返す", async () => {
  const f = fixture({ ...settings(), password: "fixture-password" });
  assert.equal((await f.request("login", microsoft)).password, "fixture-password");
  f.saved.flowStartedAt = Date.now() - 121000;
  assert.equal((await f.request("login", microsoft)).ok, false);
  f.saved.flowStartedAt = Date.now() + 30000;
  assert.equal((await f.request("login", microsoft)).ok, false);
});

test("空欄保存はKeychainの値を保持し，削除操作は両方の保存先を消す", async () => {
  const f = fixture();
  assert.equal((await f.request("save", popup, {
    enabled: true, userId: "sample@example.edu", password: "fixture-password",
  })).ok, true);
  assert.equal(Object.hasOwn(f.saved, "password"), false);
  assert.equal((await f.request("save", popup, {
    enabled: true, userId: "sample@example.edu", password: "",
  })).ok, true);
  assert.equal(f.secret(), "fixture-password");
  assert.equal((await f.request("save", popup, {
    enabled: true, userId: "different@example.edu", password: "",
  })).ok, false);
  assert.equal((await f.request("clear", popup)).ok, true);
  assert.equal(f.secret(), "");
  assert.equal(f.saved.userId, undefined);
  assert.equal(f.saved.enabled, undefined);
});
