const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../extension/timetable-core.js");

test("日本語と英語のシラバス時限，連続時限，複数曜日を読み取る", () => {
  assert.deepEqual(core.parseMeetings("月２-３／金５"), [
    { day: 0, from: 2, to: 3 }, { day: 4, from: 5, to: 5 },
  ]);
  assert.deepEqual(core.parseMeetings("Mon.2-3 / Thurs.5"), [
    { day: 0, from: 2, to: 3 }, { day: 3, from: 5, to: 5 },
  ]);
  assert.deepEqual(core.parseMeetings("フルオンデマンド"), []);
});

test("シラバス詳細から年度，学期，教室を取得する", () => {
  const fields = {
    "開講年度": "2026年度",
    "科目名": "データベース",
    "学期曜日時限": "秋学期  月２／金３",
    "使用教室": "月:５７－２０２教室／金:６１－５０５教室",
    "コース・コード": "ABC1234567",
  };
  const ths = Object.entries(fields).map(([label, value]) => ({
    textContent: label, nextElementSibling: { tagName: "TD", textContent: value },
  }));
  const doc = { querySelector: () => ({ querySelectorAll: () => ths }) };
  const result = core.parseSyllabus(doc, "valid-key");
  assert.equal(result.year, 2026);
  assert.equal(result.term, "fall_semester");
  assert.deepEqual(result.placements, [
    { year: 2026, term: "fall_semester", day: 0, from: 2, to: 2, room: "57-202" },
    { year: 2026, term: "fall_semester", day: 4, from: 3, to: 3, room: "61-505" },
  ]);
});

test("英語版シラバスの学期と曜日を読み取る", () => {
  const fields = {
    "Year": "2026", "Course Title": "Database",
    "Term/Day/Period": "fall semester  Mon.2 / Fri.3",
    "Classroom": "57-202 / 61-505",
  };
  const ths = Object.entries(fields).map(([label, value]) => ({
    textContent: label, nextElementSibling: { tagName: "TD", textContent: value },
  }));
  const doc = { querySelector: () => ({ querySelectorAll: () => ths }) };
  const result = core.parseSyllabus(doc, "english-key");
  assert.equal(result.term, "fall_semester");
  assert.deepEqual(result.placements.map(({ day, from, room }) => ({ day, from, room })), [
    { day: 0, from: 2, room: "57-202" }, { day: 4, from: 3, room: "61-505" },
  ]);
});

test("同名の検索結果でも年度とコードを優先する", () => {
  const row = (year, code, name, key) => ({ querySelectorAll: () => [
    { textContent: String(year) }, { textContent: code },
    { textContent: name, querySelector: () => ({ getAttribute: () => `post_submit('JAA104DtlSubCon', '${key}')` }) },
  ] });
  const table = { querySelectorAll: () => [
    row(2025, "ABC1234567", "データベース", "old"),
    row(2026, "OTHER", "データベース", "title-only"),
    row(2026, "ABC1234567", "データベース", "exact"),
  ] };
  const doc = { querySelector: (selector) => selector === ".ct-vh" ? table : null };
  assert.deepEqual(core.parseSearchResults(doc, { year: 2026, code: "ABC1234567", name: "データベース" })
    .map((result) => result.key), ["exact", "title-only"]);
});

test("秋学期の科目は秋・冬クォーターの両方に表示する", () => {
  assert.equal(core.termContains("fall_semester", "fall_quarter"), true);
  assert.equal(core.termContains("fall_semester", "winter_quarter"), true);
  assert.equal(core.termContains("spring_semester", "fall_quarter"), false);
  const choices = core.termChoices([
    { id: "1", year: 2026 }, { id: "2", year: 2026 },
  ], {
    1: { placements: [{ year: 2026, term: "fall_semester" }] },
    2: { placements: [{ year: 2026, term: "fall_quarter" }] },
  });
  assert.deepEqual(choices, [
    { year: 2026, term: "fall_quarter" }, { year: 2026, term: "winter_quarter" },
  ]);
});

test("9月に始まる未配置科目は秋学期の候補に入る", () => {
  const course = {
    id: "3", year: 2026, code: "2603034001",
    startdate: new Date(2026, 8, 21).getTime() / 1000,
    enddate: new Date(2027, 2, 31).getTime() / 1000,
  };
  assert.deepEqual(core.termChoices([course], {}), [{ year: 2026, term: "fall_semester" }]);
});

test("学期とクォーターが混在してもタブは開始順に並ぶ", () => {
  const choices = core.termChoices([
    { id: "spring", year: 2026 }, { id: "fall", year: 2026 },
  ], {
    spring: { placements: [{ year: 2026, term: "spring_semester" }] },
    fall: { placements: [{ year: 2026, term: "fall_quarter" }] },
  });
  assert.deepEqual(choices, [
    { year: 2026, term: "spring_semester" },
    { year: 2026, term: "fall_quarter" },
    { year: 2026, term: "winter_quarter" },
  ]);
});

test("春学期に配置済みの科目は秋学期の未配置欄に出ない", () => {
  const course = {
    id: "spring", year: 2026,
    startdate: new Date(2026, 3, 1).getTime() / 1000,
    enddate: new Date(2027, 2, 31).getTime() / 1000,
  };
  const record = { placements: [{ year: 2026, term: "spring_semester", day: 0, from: 2, to: 2 }] };
  assert.equal(core.isUnplacedInTerm(course, record, { year: 2026, term: "fall_semester" }), false);
  assert.equal(core.isUnplacedInTerm(course, record, { year: 2026, term: "spring_semester" }), false);
  assert.equal(core.isUnplacedInTerm(course, record, null), true);
});

test("曜日・時限のない科目はシラバスの学期で未配置欄とタブを絞る", () => {
  const course = {
    id: "online", year: 2026,
    startdate: new Date(2026, 3, 1).getTime() / 1000,
    enddate: new Date(2027, 2, 31).getTime() / 1000,
  };
  const record = { syllabusYear: 2026, syllabusTerm: "spring_semester", placements: [] };
  assert.equal(core.isUnplacedInTerm(course, record, { year: 2026, term: "fall_semester" }), false);
  assert.equal(core.isUnplacedInTerm(course, record, { year: 2026, term: "spring_semester" }), true);
  assert.deepEqual(core.termChoices([course], { online: record }), [
    { year: 2026, term: "spring_semester" },
  ]);
});

test("シラバスが未取得の科目はMoodleの開講期間を使う", () => {
  const course = {
    id: "unknown", year: 2026, code: "2603034001",
    startdate: new Date(2026, 8, 21).getTime() / 1000,
    enddate: new Date(2027, 2, 31).getTime() / 1000,
  };
  assert.equal(core.isUnplacedInTerm(course, {}, { year: 2026, term: "spring_semester" }), false);
  assert.equal(core.isUnplacedInTerm(course, {}, { year: 2026, term: "fall_semester" }), true);
});

test("年度のない連絡用コースから過去年度の学期タブを生成しない", () => {
  assert.equal(core.academicYear("2026年度"), 2026);
  assert.equal(core.academicYear("連絡用"), null);
  assert.equal(core.academicYear("20201"), null);
  const choices = core.termChoices([
    { id: "notice", year: 2020, code: "", startdate: new Date(2020, 3, 1).getTime() / 1000 },
    { id: "class", year: 2026, code: "2603034001" },
  ], {});
  assert.deepEqual([...new Set(choices.map((choice) => choice.year))], [2026]);
});

test("授業情報のないHTMLをシラバス取得成功として受け入れない", () => {
  const doc = { querySelector: () => ({ querySelectorAll: () => [] }) };
  assert.throws(() => core.parseSyllabus(doc, "empty"), /年度・科目名・学期/);
});
