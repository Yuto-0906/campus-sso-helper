(function initializeTimetableCore(root, factory) {
  const core = factory();
  root.CampusTimetableCore = core;
  if (typeof module !== "undefined" && module.exports) module.exports = core;
})(globalThis, function createTimetableCore() {
  "use strict";

  const TERMS = Object.freeze({
    spring_quarter: "春クォーター",
    summer_quarter: "夏クォーター",
    fall_quarter: "秋クォーター",
    winter_quarter: "冬クォーター",
    spring_semester: "春学期",
    fall_semester: "秋学期",
    full_year: "通年",
  });
  const DAYS = Object.freeze(["月", "火", "水", "木", "金", "土", "日"]);
  const TERM_ORDER = Object.freeze({
    spring_quarter: 0, spring_semester: 0, full_year: 0,
    summer_quarter: 1, fall_quarter: 2, fall_semester: 2, winter_quarter: 3,
  });
  const PERIODS = Object.freeze([
    ["8:50", "10:30"], ["10:40", "12:20"], ["13:10", "14:50"],
    ["15:05", "16:45"], ["17:00", "18:40"], ["18:55", "20:35"],
    ["20:45", "21:35"],
  ]);

  function normalize(value) {
    return String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
  }

  function schoolYear(date = new Date()) {
    const d = new Date(date);
    return d.getMonth() < 3 ? d.getFullYear() - 1 : d.getFullYear();
  }

  function termFromLabel(label) {
    const value = normalize(label).toLowerCase();
    const names = [
      ["spring_quarter", /春クォーター|spring quarter/],
      ["summer_quarter", /夏クォーター|summer quarter/],
      ["fall_quarter", /秋クォーター|fall quarter/],
      ["winter_quarter", /冬クォーター|winter quarter/],
      ["spring_semester", /春学期|spring semester/],
      ["fall_semester", /秋学期|fall semester/],
      ["full_year", /通年|full year/],
    ];
    return names.find(([, pattern]) => pattern.test(value))?.[0] ?? null;
  }

  function termContains(courseTerm, selectedTerm) {
    if (courseTerm === selectedTerm || courseTerm === "full_year") return true;
    if (courseTerm === "spring_semester") {
      return selectedTerm === "spring_quarter" || selectedTerm === "summer_quarter";
    }
    if (courseTerm === "fall_semester") {
      return selectedTerm === "fall_quarter" || selectedTerm === "winter_quarter";
    }
    return false;
  }

  function isUnplacedInTerm(course, record, selected) {
    if (!selected) return true;
    const year = record?.syllabusYear || course.year;
    if (year && year !== selected.year) return false;
    // A course with a timetable placement belongs in its scheduled term only.
    if (record?.placements?.length) return false;
    if (record?.syllabusTerm && TERMS[record.syllabusTerm]) {
      return termContains(record.syllabusTerm, selected.term);
    }
    if (!course.startdate || !course.enddate) return true;
    const range = selected.term.includes("fall") || selected.term === "winter_quarter"
      ? [new Date(selected.year, 8, 1).getTime(), new Date(selected.year + 1, 3, 1).getTime()]
      : [new Date(selected.year, 3, 1).getTime(), new Date(selected.year, 7, 1).getTime()];
    return course.startdate * 1000 < range[1] && course.enddate * 1000 > range[0];
  }

  function parseMeetings(value) {
    const text = normalize(value);
    const parts = text.split(/[／/]/).map((part) => part.replace(/^.*?:/, "").trim());
    const result = [];
    for (const part of parts) {
      const m = part.match(/^(月|火|水|木|金|土|日|Mon|Tues?|Wed|Thurs?|Fri|Sat|Sun)\.?\s*([1-7])(?:\s*[-－〜～]\s*([1-7]))?/i);
      if (!m) continue;
      const dayName = m[1].toLowerCase();
      const day = DAYS.indexOf(m[1]) >= 0
        ? DAYS.indexOf(m[1])
        : ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].findIndex((prefix) => dayName.startsWith(prefix));
      const from = Number(m[2]);
      const to = Number(m[3] ?? m[2]);
      if (day >= 0 && from <= to) result.push({ day, from, to });
    }
    return result;
  }

  function parseSyllabus(doc, key) {
    const table = doc.querySelector(".ct-common");
    if (!table) throw new Error("シラバスの授業情報を読み取れませんでした。");
    const fields = {};
    for (const th of table.querySelectorAll("th")) {
      const td = th.nextElementSibling;
      if (td?.tagName?.toLowerCase() === "td") fields[normalize(th.textContent)] = normalize(td.textContent);
    }
    const get = (...labels) => labels.map((label) => fields[label]).find(Boolean) ?? "";
    const year = Number.parseInt(get("開講年度", "Year"), 10);
    const termDayPeriod = get("学期曜日時限", "Term/Day/Period");
    const term = termFromLabel(termDayPeriod);
    const meetingText = termDayPeriod.replace(/^(?:春クォーター|夏クォーター|秋クォーター|冬クォーター|春学期|秋学期|通年|spring quarter|summer quarter|fall quarter|winter quarter|spring semester|fall semester|full year)\s*/i, "");
    const meetings = parseMeetings(meetingText);
    const rooms = get("使用教室", "Classroom").split(/[／/]/).map((part) =>
      normalize(part.replace(/^.*?:/, "")).replace(/(?:教室|室)$/, "")
    );
    return {
      key,
      year: Number.isFinite(year) ? year : null,
      title: get("科目名", "Course Title"),
      courseCode: get("コース・コード", "Course Code"),
      term,
      modality: get("授業方法区分", "Class Modality Categories"),
      placements: year && term ? meetings.map((meeting, index) => ({
        year, term, ...meeting, room: rooms[index] ?? rooms[0] ?? "",
      })) : [],
    };
  }

  function parseSearchResults(doc, course) {
    const message = normalize(doc.querySelector(".ch-message")?.textContent);
    if (/検索結果は0件|0 Search Result/i.test(message)) return [];
    const table = doc.querySelector(".ct-vh");
    if (!table) throw new Error("シラバス検索結果を読み取れませんでした。");
    const results = [];
    for (const row of table.querySelectorAll("tr")) {
      const cells = row.querySelectorAll("td");
      if (cells.length < 3) continue;
      const onclick = cells[2].querySelector("a")?.getAttribute("onclick") ?? "";
      const key = onclick.match(/post_submit\(['"]JAA104DtlSubCon['"],\s*['"]([^'"]+)['"]\)/)?.[1];
      if (!key || !/^[\w-]+$/.test(key)) continue;
      const candidate = {
        key, year: Number.parseInt(normalize(cells[0].textContent), 10),
        code: normalize(cells[1].textContent), title: normalize(cells[2].textContent),
      };
      if (course.year && Number.isFinite(candidate.year) && candidate.year !== course.year) continue;
      if (candidate.code === course.code || candidate.title === normalize(course.name)) results.push(candidate);
    }
    return results.sort((a, b) => Number(b.code === course.code) - Number(a.code === course.code));
  }

  function termChoices(courses, records) {
    const byYear = new Map();
    for (const course of courses) {
      const record = records[course.id];
      if (record?.placements?.length) {
        for (const p of record.placements) {
          if (!byYear.has(p.year)) byYear.set(p.year, new Set());
          byYear.get(p.year).add(p.term);
        }
      } else if (record?.syllabusTerm && TERMS[record.syllabusTerm] &&
          (record.syllabusYear || course.year)) {
        const year = record.syllabusYear || course.year;
        if (!byYear.has(year)) byYear.set(year, new Set());
        byYear.get(year).add(record.syllabusTerm);
      } else if (course.year) {
        if (!byYear.has(course.year)) byYear.set(course.year, new Set());
        const start = course.startdate ? course.startdate * 1000 : null;
        const end = course.enddate ? course.enddate * 1000 : null;
        if (start === null || end === null ||
            (start < new Date(course.year, 7, 1).getTime() && end > new Date(course.year, 3, 1).getTime())) {
          byYear.get(course.year).add("spring_semester");
        }
        if (start === null || end === null ||
            (start < new Date(course.year + 1, 3, 1).getTime() && end > new Date(course.year, 8, 1).getTime())) {
          byYear.get(course.year).add("fall_semester");
        }
      }
    }
    const choices = [];
    for (const [year, terms] of byYear) {
      const hasSpringQuarter = terms.has("spring_quarter") || terms.has("summer_quarter");
      const hasFallQuarter = terms.has("fall_quarter") || terms.has("winter_quarter");
      if (terms.has("spring_semester") || hasSpringQuarter || terms.has("full_year")) {
        choices.push(...(hasSpringQuarter ? ["spring_quarter", "summer_quarter"] : ["spring_semester"]).map((term) => ({ year, term })));
      }
      if (terms.has("fall_semester") || hasFallQuarter || terms.has("full_year")) {
        choices.push(...(hasFallQuarter ? ["fall_quarter", "winter_quarter"] : ["fall_semester"]).map((term) => ({ year, term })));
      }
    }
    return choices.sort((a, b) => a.year - b.year || TERM_ORDER[a.term] - TERM_ORDER[b.term]);
  }

  return Object.freeze({ TERMS, DAYS, PERIODS, normalize, schoolYear, termFromLabel,
    termContains, isUnplacedInTerm, parseMeetings, parseSyllabus, parseSearchResults, termChoices });
});
