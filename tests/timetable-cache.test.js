const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const core = require("../extension/timetable-core.js");

const source = fs.readFileSync(path.join(__dirname, "../extension/timetable.js"), "utf8");
const cachedCourse = {
  id: "42", name: "前回の科目", code: "", year: 2026,
  url: "https://wsdmoodle.waseda.jp/course/view.php?id=42",
};

class Element {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.className = "";
    this.style = { setProperty() {} };
    this.scrollLeft = 0;
    this.classList = {
      add: (name) => { this.className = `${this.className} ${name}`.trim(); },
      remove: (name) => { this.className = this.className.split(" ").filter((item) => item !== name).join(" "); },
    };
  }

  appendChild(node) { this.children.push(node); return node; }
  append(...nodes) { nodes.forEach((node) => this.appendChild(node)); }
  prepend(node) { this.children.unshift(node); }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  addEventListener() {}
  get lastChild() { return this.children.at(-1); }
  get childElementCount() { return this.children.length; }
  getBoundingClientRect() { return { left: 0, right: 100 }; }

  querySelector(selector) {
    const className = selector.startsWith(".") ? selector.slice(1) : null;
    for (const child of this.children) {
      if (className && child.className?.split(" ").includes(className)) return child;
      const descendant = child.querySelector?.(selector);
      if (descendant) return descendant;
    }
    return null;
  }

  set innerHTML(value) { this.value = value; }
}

async function startWithCachedCourses(fetchResponse) {
  const region = new Element("div");
  const writes = [];
  const saved = { courses: [cachedCourse], records: {}, failed: {}, hidden: {}, notes: [],
    selected: "2026:fall_semester" };
  const document = {
    documentElement: { innerHTML: "logout.php?sesskey=abc123" },
    createElement: (tag) => new Element(tag),
    getElementById: () => null,
    querySelector: (selector) => {
      if (selector === "#block-region-content") return region;
      if (selector.startsWith('a[href*="/user/profile.php')) {
        return { href: "https://wsdmoodle.waseda.jp/user/profile.php?id=123" };
      }
      return null;
    },
  };
  const browser = { storage: { local: {
    get: async (key) => key === "csh-timetable-v1:123" ? { [key]: saved } : {},
    set: async (value) => { writes.push(value["csh-timetable-v1:123"]); },
  } } };
  let fetchCalls = 0;
  await vm.runInNewContext(source, {
    location: { hostname: "wsdmoodle.waseda.jp", pathname: "/my/" },
    document, browser, CampusTimetableCore: core,
    fetch: () => { fetchCalls++; return fetchResponse; },
  }, { filename: "timetable.js" });
  const root = region.children[0];
  return { root, writes, fetchCalls: () => fetchCalls };
}

test("保存済みの科目と学期を通信完了前に表示し，取得後に更新する", async () => {
  let completeFetch;
  const pending = new Promise((resolve) => { completeFetch = resolve; });
  const page = await startWithCachedCourses(pending);
  assert.equal(page.fetchCalls(), 1);
  assert.match(page.root.querySelector(".csh-status").textContent, /保存済みの1科目/);
  assert.equal(page.root.querySelector(".csh-card-title").textContent, "前回の科目");
  assert.equal(page.root.querySelector(".csh-active").textContent, "2026年 秋学期");

  completeFetch({ ok: true, json: async () => [{ data: { courses: [{
    id: 99, fullname: "最新の科目", idnumber: "", coursecategory: "2026",
  }] } }] });
  await new Promise(setImmediate);
  assert.equal(page.root.querySelector(".csh-card-title").textContent, "最新の科目");
  assert.equal(page.writes.at(-1).courses[0].id, "99");
  assert.equal(page.writes.at(-1).selected, "2026:fall_semester");
});

test("更新に失敗しても保存済みの科目を表示し続ける", async () => {
  let failFetch;
  const pending = new Promise((_, reject) => { failFetch = reject; });
  const page = await startWithCachedCourses(pending);
  failFetch(new Error("offline"));
  await new Promise(setImmediate);
  assert.equal(page.root.querySelector(".csh-card-title").textContent, "前回の科目");
  assert.match(page.root.querySelector(".csh-status").textContent, /更新に失敗しました：offline/);
});
