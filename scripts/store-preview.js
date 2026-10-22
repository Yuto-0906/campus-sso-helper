// CI-only automation of the shipping offline sample's public controls.
// Injected by a DEBUG-only native hook; never bundled in the Release app.
(async () => {
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const signal = (name) => window.webkit.messageHandlers.controller.postMessage(`STORE_PREVIEW:${name}`);
  const requireElement = (selector) => {
    const node = document.querySelector(selector);
    if (!node) throw new Error(`Missing ${selector}`);
    return node;
  };
  const button = (name, parent = document) => {
    const node = [...parent.querySelectorAll("button")].find((item) => item.textContent === name);
    if (!node) throw new Error(`Missing button ${name}`);
    return node;
  };
  const field = (name) => {
    const label = [...requireElement(".csh-modal").querySelectorAll("label")]
      .find((item) => item.querySelector("span")?.textContent === name);
    if (!label) throw new Error(`Missing field ${name}`);
    return label.querySelector("input, select, textarea");
  };
  try {
    for (let attempt = 0; !document.querySelector(".csh-card-title") && attempt < 100; attempt++) await pause(100);
    requireElement(".csh-card-title");
    const video = globalThis.CSH_PREVIEW_MODE === "video";
    // Leave enough time for the simulator's launch animation and status bar to settle.
    await pause(2000);
    signal("timetable");
    await pause(video ? 4000 : 2200);
    [...document.querySelectorAll(".csh-card-title")].find((item) => item.textContent === "情報デザイン").click();
    await pause(700);
    field("メモ").value = "教科書・ノートPCを持参";
    field("教室").value = "A-201";
    signal("editor");
    await pause(video ? 4500 : 2200);
    button("保存", requireElement(".csh-modal")).click();
    await pause(700);
    signal("saved");
    await pause(video ? 3000 : 2200);
    button("2026年 春学期").click();
    await pause(700);
    signal("spring");
    await pause(video ? 3500 : 2200);
    button("2026年 秋学期").click();
    await pause(700);
    button("予定を追加").click();
    await pause(500);
    field("タイトル").value = "レポートの準備";
    field("曜日").value = "0";
    field("開始").value = "3";
    field("終了").value = "3";
    signal("note-editor");
    await pause(video ? 3500 : 2200);
    button("保存", requireElement(".csh-modal")).click();
    await pause(700);
    requireElement(".csh-note");
    signal("note-saved");
    await pause(video ? 4500 : 2200);
    signal("complete");
  } catch (error) {
    signal(`error:${error.message}`);
  }
})();
