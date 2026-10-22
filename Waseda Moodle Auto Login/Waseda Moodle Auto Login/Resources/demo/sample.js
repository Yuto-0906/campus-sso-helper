"use strict";
// Fictional courses; this page cannot connect to university or sign-in services.
globalThis.CampusTimetableSample = {
  selected: "2026:fall_semester", notes: [], hidden: {}, failed: {},
  courses: [
    { id: "sample-1", name: "情報デザイン", year: 2026, url: "#sample-1" },
    { id: "sample-2", name: "プログラミング演習", year: 2026, url: "#sample-2" },
    { id: "sample-3", name: "データの基礎", year: 2026, url: "#sample-3" },
    { id: "sample-4", name: "英語コミュニケーション", year: 2026, url: "#sample-4" },
    { id: "sample-5", name: "研究プロジェクト", year: 2026, url: "#sample-5" },
    { id: "sample-6", name: "デザイン基礎", year: 2026, url: "#sample-6" },
  ],
  records: {
    "sample-1": { color: "#b8825b", placements: [{ year: 2026, term: "fall_semester", day: 0, from: 2, to: 2, room: "A-201" }] },
    "sample-2": { color: "#829587", note: "ノートPCを持参", placements: [{ year: 2026, term: "fall_semester", day: 1, from: 3, to: 4, room: "B-302" }] },
    "sample-3": { color: "#a38b9a", placements: [{ year: 2026, term: "fall_semester", day: 3, from: 2, to: 2, room: "C-101" }] },
    "sample-4": { color: "#a2986a", placements: [{ year: 2026, term: "fall_semester", day: 2, from: 1, to: 1, room: "A-105" }] },
    "sample-5": { color: "#8c9aa7", syllabusTerm: "fall_semester", syllabusYear: 2026, modality: "オンデマンド", placements: [] },
    "sample-6": { color: "#b8825b", placements: [{ year: 2026, term: "spring_semester", day: 0, from: 3, to: 3, room: "D-204" }] },
  },
};
