(async function startTimetable() {
  "use strict";

  if (location.hostname !== "wsdmoodle.waseda.jp" || !location.pathname.startsWith("/my/")) return;
  const api = globalThis.browser;
  const core = globalThis.CampusTimetableCore;
  if (!api?.storage?.local || !core) return;

  const state = {
    courses: [], records: {}, failed: {}, hidden: {}, notes: [], selected: undefined,
    showHidden: false, status: "履修科目を読み込んでいます…", storageKey: null,
    root: null, original: null, syncing: false, coursesLoaded: false, coursesFresh: false,
    revealSelectedTab: true,
    syncReport: null,
  };
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  function decodeCourseName(value) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = String(value ?? "");
    return core.normalize(textarea.value);
  }

  function getSessionKeyFrom(html) {
    const byURL = html.match(/logout\.php[^"'<>]*(?:[?&]|&amp;)sesskey=([a-zA-Z0-9]+)/);
    if (byURL) return byURL[1];
    return html.match(/["']sesskey["']\s*:\s*["']([a-zA-Z0-9]+)["']/)?.[1] ?? null;
  }

  async function getSessionKey() {
    const current = getSessionKeyFrom(document.documentElement.innerHTML);
    if (current) return current;
    const response = await fetch("https://wsdmoodle.waseda.jp/my/", { credentials: "include" });
    if (!response.ok) throw new Error(`Moodleの応答: HTTP ${response.status}`);
    const key = getSessionKeyFrom(await response.text());
    if (!key) throw new Error("Moodleにログインした後，ダッシュボードを開いてください。");
    return key;
  }

  async function fetchCourses() {
    const key = await getSessionKey();
    const courses = [];
    for (let offset = 0; offset < 10000; offset += 1000) {
      const response = await fetch(`https://wsdmoodle.waseda.jp/lib/ajax/service.php?sesskey=${encodeURIComponent(key)}`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify([{ index: 0, methodname: "core_course_get_enrolled_courses_by_timeline_classification",
          args: { classification: "allincludinghidden", customfieldname: "", customfieldvalue: "",
            limit: 1000, offset, sort: "fullname" } }]),
      });
      if (!response.ok) throw new Error(`履修科目の取得に失敗しました: HTTP ${response.status}`);
      const result = await response.json();
      const first = result?.[0];
      if (first?.error || !Array.isArray(first?.data?.courses)) {
        throw new Error(first?.exception?.message || "履修科目の応答を読み取れませんでした。");
      }
      courses.push(...first.data.courses);
      if (first.data.courses.length < 1000) break;
    }
    return courses.map((course) => ({
      id: String(course.id), name: decodeCourseName(course.fullname || course.shortname || "科目名なし"),
      code: String(course.idnumber ?? "").trim().length === 16 ? String(course.idnumber).trim().slice(4, 14) : "",
      category: decodeCourseName(course.coursecategory),
      year: core.academicYear(decodeCourseName(course.coursecategory)),
      startdate: course.startdate, enddate: course.enddate,
      hiddenByMoodle: Boolean(course.hidden),
      url: /^https:\/\/wsdmoodle\.waseda\.jp\//.test(course.viewurl ?? "") ? course.viewurl :
        `https://wsdmoodle.waseda.jp/course/view.php?id=${encodeURIComponent(course.id)}`,
    }));
  }

  async function loadStorage() {
    const profile = document.querySelector('a[href*="/user/profile.php?id="]')?.href.match(/[?&]id=(\d+)/)?.[1];
    const moodleUser = profile ? null : document.documentElement.innerHTML.match(/["']userid["']\s*:\s*(\d+)/)?.[1];
    const prefs = profile || moodleUser ? {} : await api.storage.local.get(["userId"]);
    const identity = profile || moodleUser || prefs.userId || "local";
    state.storageKey = `csh-timetable-v1:${identity}`;
    const saved = (await api.storage.local.get(state.storageKey))[state.storageKey] ?? {};
    // Keep each map independent across the Safari storage bridge and accept
    // only explicit booleans as visibility preferences.
    state.records = JSON.parse(JSON.stringify(saved.records ?? {}));
    state.failed = Object.fromEntries(Object.entries(saved.failed ?? {}).filter(([, timestamp]) => Number.isFinite(timestamp)));
    state.hidden = core.sanitizeHidden(saved.hidden);
    state.notes = saved.notes ?? [];
    state.selected = saved.selected;
    if (Object.values(saved.hidden ?? {}).some((value) => typeof value !== "boolean")) state.selected = undefined;
    state.syncReport = saved.syncReport ?? null;
    for (const [id, record] of Object.entries(state.records)) {
      if (record.syllabusKey && !core.academicYear(record.syllabusYear)) {
        delete record.syllabusKey;
        delete record.syllabusYear;
        delete record.syllabusTerm;
        if (!record.manual) record.placements = [];
        delete state.failed[id];
      }
    }
    if (Array.isArray(saved.courses) && saved.courses.every((course) =>
      course && typeof course.id === "string" && typeof course.name === "string" &&
      typeof course.url === "string" && /^https:\/\/wsdmoodle\.waseda\.jp\//.test(course.url))) {
      state.courses = saved.courses;
      state.coursesLoaded = true;
      state.original?.classList.add("csh-original-overview");
    }
  }

  async function saveStorage() {
    if (!state.storageKey) return;
    const saved = {
      records: state.records, failed: state.failed, hidden: core.sanitizeHidden(state.hidden),
      notes: state.notes, selected: state.selected,
      syncReport: state.syncReport,
    };
    if (state.coursesLoaded) saved.courses = state.courses;
    await api.storage.local.set({ [state.storageKey]: saved });
  }

  async function syllabusHTML(path, fields) {
    const response = await api.runtime.sendMessage({ type: "campus-sso:syllabus-request", path, fields });
    if (!response?.ok) throw new Error(response?.error || "シラバスを取得できませんでした。");
    if (state.syncReport) {
      const transport = response.transport || "web";
      state.syncReport.transports[transport] = (state.syncReport.transports[transport] || 0) + 1;
    }
    return new DOMParser().parseFromString(response.html, "text/html");
  }

  let oldYearsPromise;
  async function oldYears() {
    oldYearsPromise ??= syllabusHTML("/syllabus/JAA102.php").then((doc) =>
      [...doc.querySelectorAll("#nendo option")].map((option) => Number.parseInt(option.value, 10))
        .filter(Number.isFinite)).catch(() => []);
    return oldYearsPromise;
  }

  function searchForm(course, yearIsOld, page) {
    return [
      ["p_number", "100"], ["p_page", page === 1 ? "" : String(page)],
      ["pfrontPage", yearIsOld ? "past" : "now"], ["keyword", course.code],
      ["kamoku", course.name], ["kyoin", ""], ["p_gakki", ""], ["p_youbi", ""],
      ["p_jigen", ""], ["p_gengo", ""], ["p_jyugyohoho", ""],
      ["p_open", ""], ["p_gakubu", ""], ["p_keya", ""], ["p_keyb", ""],
      ["p_keyc", ""], ["p_searcha", "a"], ["p_searchb", "b"], ["p_searchc", ""],
      ["nendo", yearIsOld ? String(course.year) : ""], ["pYear", ""], ["pSchl", ""],
      ["pClsOpnSts", yearIsOld ? "0" : "123"], ["pKyoincd", ""], ["pKey", ""],
      ["bunya1_hid", ""], ["bunya2_hid", ""], ["bunya3_hid", ""],
      ["level_hid", ""], ["ControllerParameters", "JAA103SubCon"],
      ["pOcw", ""], ["pType", ""], ["pLng", "jp"],
    ];
  }

  async function lookupSyllabus(course, pastYears, trace) {
    if (!course.code) return null;
    const isOld = Number.isInteger(course.year) &&
      (pastYears.includes(course.year) || (pastYears.length === 0 && course.year < core.schoolYear()));
    trace.searchMode = isOld ? "past" : "now";
    trace.searches = [];
    let detailError;
    for (let page = 1; page <= 3; page++) {
      const doc = await syllabusHTML("/syllabus/index.php", searchForm(course, isOld, page));
      const results = core.parseSearchResults(doc, course);
      trace.searches.push({ page, matches: results.length });
      for (const candidate of results) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        try {
          const detail = await syllabusHTML(`/syllabus/JAA104.php?pKey=${encodeURIComponent(candidate.key)}&pLng=jp`);
          const parsed = core.parseSyllabus(detail, candidate.key);
          trace.detail = { title: parsed.title, year: parsed.year, term: parsed.term, placements: parsed.placements.length };
          if (parsed.year && course.year && parsed.year !== course.year) continue;
          if (core.normalize(parsed.courseCode) !== course.code &&
              core.normalize(parsed.title) !== core.normalize(course.name)) continue;
          return parsed;
        } catch (error) { detailError = error; }
      }
      if (doc.querySelectorAll(".ct-vh tr td").length < 900) break;
    }
    if (detailError) throw detailError;
    return null;
  }

  function summary() {
    const confirmed = state.courses.filter((course) => state.records[course.id]?.syllabusKey &&
      core.academicYear(state.records[course.id].syllabusYear)).length;
    const placed = state.courses.filter((course) => state.records[course.id]?.placements?.length).length;
    return `履修${state.courses.length}科目。シラバス確認済み${confirmed}科目，時間割配置済み${placed}科目。`;
  }

  async function synchronize(force = false) {
    if (state.syncing) return;
    state.syncing = true;
    try {
      state.status = state.coursesLoaded
        ? `保存済みの${state.courses.length}科目を表示中。最新情報を確認しています…`
        : "履修科目を取得しています…";
      render();
      state.courses = await fetchCourses();
      state.coursesLoaded = true;
      state.coursesFresh = true;
      state.original?.classList.add("csh-original-overview");
      const choices = termChoices(state.courses);
      if (state.selected === undefined || state.selected !== null &&
          !choices.some((item) => `${item.year}:${item.term}` === state.selected)) {
        const currentYear = core.schoolYear();
        const month = new Date().getMonth();
        const likely = month >= 9 || month < 3 ? "fall" : "spring";
        const match = [...choices].reverse().find((item) => item.year === currentYear && item.term.startsWith(likely));
        const fallback = match ?? choices.at(-1);
        state.selected = fallback ? `${fallback.year}:${fallback.term}` : null;
      }
      await saveStorage();
      render();

      const candidates = state.courses.filter((course) => {
        const record = state.records[course.id];
        // Older saved records have no term for classes without fixed periods.
        const needsTerm = record?.syllabusKey && record.syllabusTerm === undefined &&
          !record.placements?.length;
        return course.code && (!record?.syllabusKey || needsTerm || force && !record.manual) &&
          (force || !state.failed[course.id] || Date.now() - state.failed[course.id] > 24 * 60 * 60 * 1000);
      });
      if (!candidates.length) {
        state.status = summary();
        return;
      }
      state.syncReport = { attempted: candidates.length, success: 0, missing: 0, errors: 0, transports: {}, samples: [] };
      if (force) oldYearsPromise = undefined;
      const pastYears = await oldYears();
      let completed = 0;
      let failures = 0;
      let lastFailure;
      for (const course of candidates) {
        const trace = { name: course.name, category: course.category, year: course.year, code: course.code };
        state.status = `シラバスを取得中 ${completed + 1}/${candidates.length}：${course.name}`;
        renderStatus();
        try {
          const syllabus = await lookupSyllabus(course, pastYears, trace);
          if (syllabus) {
            const previous = state.records[course.id] ?? {};
            state.records[course.id] = { ...previous, syllabusKey: syllabus.key,
              syllabusYear: syllabus.year, syllabusTerm: syllabus.term,
              modality: syllabus.modality, placements: previous.manual ? previous.placements : syllabus.placements };
            delete state.failed[course.id];
            state.syncReport.success++;
            const currentChoices = termChoices(state.courses);
            if (!currentChoices.some((item) => `${item.year}:${item.term}` === state.selected)) {
              const sameSeason = currentChoices.find((item) =>
                item.year === course.year && item.term.startsWith(syllabus.term?.split("_")[0] ?? ""));
              if (sameSeason) state.selected = `${sameSeason.year}:${sameSeason.term}`;
            }
          } else {
            failures++;
            state.syncReport.missing++;
            trace.result = "一致する検索結果なし";
            state.failed[course.id] = Date.now();
          }
        } catch (error) {
          failures++;
          state.syncReport.errors++;
          trace.error = error.message;
          state.failed[course.id] = Date.now();
          lastFailure = error.message;
          state.status = `シラバス取得に失敗しました：${error.message}`;
        }
        completed++;
        if (state.syncReport.samples.length < 8 || /データベース/.test(course.name)) state.syncReport.samples.push(trace);
        await saveStorage();
        render();
        if (completed < candidates.length) await new Promise((resolve) => setTimeout(resolve, 500));
      }
      state.status = summary() +
        (failures ? ` ${failures}科目は手動で配置できます。` : "") +
        (completed === failures && lastFailure ? ` 最後のエラー：${lastFailure}` : "");
    } catch (error) {
      state.status = state.coursesLoaded
        ? `${state.courses.length}科目を表示しています。更新に失敗しました：${error.message}`
        : error.message;
      if (!state.coursesLoaded) state.original?.classList.remove("csh-original-overview");
    } finally {
      state.syncing = false;
      render();
    }
  }

  function selectedTerm() {
    if (!state.selected) return null;
    const [year, term] = state.selected.split(":");
    return { year: Number(year), term };
  }

  function termChoices(courses) {
    const noteCourses = state.notes.map((note) => ({ id: note.id }));
    const noteRecords = Object.fromEntries(state.notes.map((note) => [note.id, { placements: [note] }]));
    return core.termChoices([...courses, ...noteCourses], { ...state.records, ...noteRecords });
  }

  function makeButton(label, click, className = "") {
    const button = el("button", className, label);
    button.type = "button";
    button.addEventListener("click", click);
    return button;
  }

  function renderStatus() {
    const node = state.root?.querySelector(".csh-status");
    if (node) node.textContent = state.status;
  }

  function courseCard(course, placement) {
    const record = state.records[course.id] ?? {};
    const card = el("article", "csh-card");
    card.style.borderLeftColor = record.color || "#adb8bf";
    const title = el("a", "csh-card-title", course.name);
    title.href = course.url;
    title.target = "_blank";
    title.rel = "noopener";
    card.appendChild(title);
    if (placement?.room) card.appendChild(el("div", "csh-card-room", `♟ ${placement.room}`));
    if (placement?.to > placement?.from) card.appendChild(el("div", "csh-card-room", `${placement.from}–${placement.to}限`));
    if (record.modality) card.appendChild(el("div", "csh-card-mode", record.modality));
    if (record.note) card.appendChild(el("div", "csh-card-mode", record.note));
    card.appendChild(makeButton("編集", () => editCourse(course), "csh-card-edit"));
    return card;
  }

  function renderGrid(container, selected, courses) {
    const entries = [];
    for (const course of courses) {
      for (const placement of state.records[course.id]?.placements ?? []) {
        if (placement.year === selected.year && core.termContains(placement.term, selected.term)) {
          entries.push({ course, placement });
        }
      }
    }
    const notes = state.notes.filter((note) => note.year === selected.year && core.termContains(note.term, selected.term));
    const days = entries.some(({ placement }) => placement.day === 6) || notes.some((note) => note.day === 6) ? 7
      : entries.some(({ placement }) => placement.day === 5) || notes.some((note) => note.day === 5) ? 6 : 5;
    const rows = entries.some(({ placement }) => placement.to >= 7) || notes.some((note) => note.to >= 7) ? 7
      : entries.some(({ placement }) => placement.to >= 6) || notes.some((note) => note.to >= 6) ? 6 : 5;
    const scroller = el("div", "csh-scroll");
    const grid = el("div", "csh-grid");
    grid.style.setProperty("--csh-days", days);
    grid.appendChild(el("div", "csh-corner"));
    for (let day = 0; day < days; day++) grid.appendChild(el("div", "csh-day-heading", core.DAYS[day]));
    for (let period = 1; period <= rows; period++) {
      const time = el("div", "csh-time");
      time.append(el("span", "", core.PERIODS[period - 1][0]), el("strong", "", String(period)),
        el("span", "", core.PERIODS[period - 1][1]));
      grid.appendChild(time);
      for (let day = 0; day < days; day++) {
        const cell = el("div", "csh-cell");
        const cellEntries = entries.filter(({ placement }) => placement.day === day && placement.from === period);
        for (const item of cellEntries) cell.appendChild(courseCard(item.course, item.placement));
        for (const note of notes.filter((item) => item.day === day && item.from === period)) {
          const noteCard = el("article", "csh-card csh-note", note.title);
          noteCard.appendChild(makeButton("編集", () => editNote(note), "csh-card-edit"));
          cell.appendChild(noteCard);
        }
        if (!cellEntries.length && !cell.childElementCount && entries.some(({ placement }) =>
          placement.day === day && placement.from < period && placement.to >= period)) cell.classList.add("csh-continuation");
        grid.appendChild(cell);
      }
    }
    scroller.appendChild(grid);
    container.appendChild(scroller);
  }

  function render() {
    if (!state.root) return;
    const tabScrollLeft = state.root.querySelector(".csh-tabs")?.scrollLeft ?? 0;
    state.root.replaceChildren();
    const header = el("div", "csh-header");
    header.appendChild(el("h2", "", "コース概要・時間割"));
    const actions = el("div", "csh-actions");
    actions.appendChild(makeButton(state.syncing ? "取得中…" : "更新", () => synchronize(true)));
    actions.lastChild.disabled = state.syncing;
    actions.appendChild(makeButton(state.showHidden ? "非表示を隠す" : "非表示を表示", () => {
      state.showHidden = !state.showHidden; render();
    }));
    actions.appendChild(makeButton("予定を追加", () => editNote(null)));
    actions.appendChild(makeButton("取得状況", showDiagnostics));
    header.appendChild(actions);
    state.root.appendChild(header);
    state.root.appendChild(el("p", "csh-status", state.status));

    const visible = core.visibleCourses(state.courses, state.hidden, state.showHidden);
    const choices = termChoices(visible);
    if (state.coursesFresh && state.selected !== null && state.selected !== undefined &&
        !choices.some((item) => `${item.year}:${item.term}` === state.selected)) {
      const fallback = choices.at(-1);
      state.selected = fallback ? `${fallback.year}:${fallback.term}` : null;
      saveStorage();
    }
    const tabs = el("div", "csh-tabs");
    tabs.appendChild(makeButton("すべて", () => { state.selected = null; saveStorage(); render(); },
      state.selected === null ? "csh-active" : ""));
    for (const choice of choices) {
      const value = `${choice.year}:${choice.term}`;
      tabs.appendChild(makeButton(`${choice.year}年 ${core.TERMS[choice.term]}`, () => {
        state.selected = value; saveStorage(); render();
      }, state.selected === value ? "csh-active" : ""));
    }
    state.root.appendChild(tabs);

    const selected = selectedTerm();
    if (selected) renderGrid(state.root, selected, visible);
    const unplaced = visible.filter((course) =>
      core.isUnplacedInTerm(course, state.records[course.id], selected));
    const section = el("section", "csh-unplaced");
    section.appendChild(el("h3", "", selected ? "時間割に未配置の科目" : "すべての科目"));
    const list = el("div", "csh-unplaced-list");
    for (const course of unplaced) list.appendChild(courseCard(course));
    if (!unplaced.length) list.appendChild(el("p", "", "該当する科目はありません。"));
    section.appendChild(list);
    state.root.appendChild(section);
    tabs.scrollLeft = tabScrollLeft;
    if (state.coursesLoaded && state.revealSelectedTab) {
      const active = tabs.querySelector(".csh-active");
      if (active) {
        state.revealSelectedTab = false;
        const tabBounds = tabs.getBoundingClientRect();
        const activeBounds = active.getBoundingClientRect();
        if (activeBounds.right > tabBounds.right) tabs.scrollLeft += activeBounds.right - tabBounds.right;
        else if (activeBounds.left < tabBounds.left) tabs.scrollLeft -= tabBounds.left - activeBounds.left;
      }
    }
  }

  function addField(parent, label, control) {
    const row = el("label", "csh-field");
    row.append(el("span", "", label), control);
    parent.appendChild(row);
    return control;
  }

  function select(options, selected) {
    const input = el("select");
    for (const [value, label] of options) {
      const option = el("option", "", label);
      option.value = String(value);
      option.selected = String(value) === String(selected);
      input.appendChild(option);
    }
    return input;
  }

  function modal(title) {
    const overlay = el("div", "csh-overlay");
    const panel = el("div", "csh-modal");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", title);
    panel.appendChild(el("h3", "", title));
    overlay.appendChild(panel);
    overlay.addEventListener("click", (event) => { if (event.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    return { overlay, panel };
  }

  function showDiagnostics() {
    const { overlay, panel } = modal("時間割の取得状況");
    panel.appendChild(el("p", "", summary()));
    panel.appendChild(el("p", "", "パスワードやログイン情報は含みません。内容を選択してコピーできます。"));
    const years = {};
    for (const course of state.courses) years[course.year ?? "不明"] = (years[course.year ?? "不明"] || 0) + 1;
    const report = {
      version: api.runtime.getManifest?.().version,
      selected: state.selected,
      courses: state.courses.length,
      withSyllabusCode: state.courses.filter((course) => course.code).length,
      years,
      sync: state.syncReport,
      samples: state.courses.filter((course) => course.code).slice(0, 6).map((course) => {
        const record = state.records[course.id];
        return { name: course.name, category: course.category, year: course.year, code: course.code,
          syllabusYear: record?.syllabusYear, syllabusTerm: record?.syllabusTerm, placements: record?.placements?.length ?? 0 };
      }),
    };
    const text = addField(panel, "診断情報", el("textarea"));
    text.readOnly = true;
    text.rows = 14;
    text.value = JSON.stringify(report, null, 2);
    text.addEventListener("click", () => text.select());
    panel.appendChild(makeButton("閉じる", () => overlay.remove()));
  }

  function placementEditor(parent, value = {}) {
    const item = el("fieldset", "csh-placement-editor");
    const selected = selectedTerm();
    const year = addField(item, "年度", el("input"));
    year.type = "number"; year.min = "2000"; year.max = "2100";
    year.value = value.year ?? selected?.year ?? core.schoolYear();
    const term = addField(item, "学期", select(Object.entries(core.TERMS), value.term ?? selected?.term ?? "spring_semester"));
    const day = addField(item, "曜日", select(core.DAYS.map((name, i) => [i, name]), value.day ?? 0));
    const periods = Array.from({ length: 7 }, (_, i) => [i + 1, `${i + 1}限`]);
    const from = addField(item, "開始", select(periods, value.from ?? 1));
    const to = addField(item, "終了", select(periods, value.to ?? value.from ?? 1));
    const room = addField(item, "教室", el("input")); room.value = value.room ?? "";
    item.appendChild(makeButton("この時限を削除", () => item.remove(), "csh-danger"));
    parent.appendChild(item);
    return { node: item, read: () => {
      const result = { year: Number(year.value), term: term.value, day: Number(day.value),
        from: Number(from.value), to: Number(to.value), room: room.value.trim() };
      if (!Number.isInteger(result.year) || result.year < 2000 || result.year > 2100 || result.from > result.to) {
        throw new Error("年度または時限を確認してください。");
      }
      return result;
    } };
  }

  function editCourse(course) {
    const record = state.records[course.id] ?? {};
    const { overlay, panel } = modal(course.name);
    const links = el("div", "csh-modal-links");
    const moodle = el("a", "", "Moodleを開く");
    moodle.href = course.url; moodle.target = "_blank"; moodle.rel = "noopener";
    links.appendChild(moodle);
    if (record.syllabusKey && /^[\w-]+$/.test(record.syllabusKey)) {
      const syllabus = el("a", "", "シラバスを開く");
      syllabus.href = `https://www.wsl.waseda.jp/syllabus/JAA104.php?pKey=${encodeURIComponent(record.syllabusKey)}&pLng=jp`;
      syllabus.target = "_blank"; syllabus.rel = "noopener";
      links.appendChild(syllabus);
    }
    panel.appendChild(links);
    const placementList = el("div");
    const readers = [];
    for (const p of record.placements ?? []) readers.push(placementEditor(placementList, p));
    panel.appendChild(placementList);
    panel.appendChild(makeButton("曜日・時限を追加", () => readers.push(placementEditor(placementList))));
    const note = addField(panel, "メモ", el("textarea")); note.value = record.note ?? "";
    const color = addField(panel, "カードの色", el("input"));
    color.type = "color"; color.value = /^#[0-9a-f]{6}$/i.test(record.color ?? "") ? record.color : "#00ad88";
    const hidden = addField(panel, "この科目を非表示", el("input"));
    hidden.type = "checkbox"; hidden.checked = state.hidden[course.id] === true;
    const error = el("p", "csh-error"); panel.appendChild(error);
    const buttons = el("div", "csh-modal-actions");
    buttons.appendChild(makeButton("キャンセル", () => overlay.remove()));
    buttons.appendChild(makeButton("保存", async () => {
      try {
        const placements = readers.filter((entry) => entry.node.isConnected).map((entry) => entry.read());
        state.records[course.id] = { ...record, placements, manual: true, note: note.value.trim(), color: color.value };
        state.hidden[course.id] = hidden.checked;
        await saveStorage();
        overlay.remove(); render();
      } catch (cause) { error.textContent = cause.message; }
    }, "csh-primary"));
    panel.appendChild(buttons);
  }

  function editNote(existing) {
    const { overlay, panel } = modal(existing ? "予定を編集" : "予定を追加");
    const selected = selectedTerm();
    const title = addField(panel, "タイトル", el("input")); title.value = existing?.title ?? "";
    const editor = el("div");
    const entry = placementEditor(editor, existing ?? { year: selected?.year, term: selected?.term });
    editor.querySelector(".csh-danger")?.remove();
    panel.appendChild(editor);
    const buttons = el("div", "csh-modal-actions");
    if (existing) buttons.appendChild(makeButton("削除", async () => {
      state.notes = state.notes.filter((note) => note.id !== existing.id);
      await saveStorage(); overlay.remove(); render();
    }, "csh-danger"));
    buttons.appendChild(makeButton("キャンセル", () => overlay.remove()));
    buttons.appendChild(makeButton("保存", async () => {
      try {
        if (!title.value.trim()) throw new Error("タイトルを入力してください。");
        const value = { id: existing?.id ?? `note-${Date.now()}-${Math.random()}`, title: title.value.trim(), ...entry.read() };
        state.notes = existing ? state.notes.map((note) => note.id === existing.id ? value : note) : [...state.notes, value];
        await saveStorage(); overlay.remove(); render();
      } catch (cause) { panel.querySelector(".csh-error").textContent = cause.message; }
    }, "csh-primary"));
    panel.appendChild(el("p", "csh-error")); panel.appendChild(buttons);
  }

  function mount() {
    const existing = document.getElementById("csh-timetable");
    if (existing) return existing;
    const region = document.querySelector("#block-region-content") || document.querySelector("#region-main");
    if (!region) return null;
    const root = el("section"); root.id = "csh-timetable";
    const starred = document.querySelector(".block-starredcourses")?.parentElement;
    if (starred && region.contains(starred)) {
      starred.insertAdjacentElement("beforebegin", root);
      state.original = starred;
    } else region.prepend(root);
    return root;
  }

  state.root = mount();
  if (!state.root) {
    const observer = new MutationObserver(() => {
      state.root = mount();
      if (state.root) { observer.disconnect(); loadStorage().then(() => synchronize()); }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 15000);
  } else {
    await loadStorage();
    synchronize();
  }
})();
