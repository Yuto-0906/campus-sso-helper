// Deterministic App Store layouts around unmodified simulator screenshots.
// Requires sharp; run with the actual Sources captured by capture_store_screens.py.
const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");
const { createHash } = require("node:crypto");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "AppStoreAssets/Storefront-v2.1");
const SOURCES = path.resolve(process.argv[2] || path.join(OUT, "Sources"));
const FONT = "'Yu Gothic', 'Hiragino Sans', sans-serif";
const esc = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
const svg = (width, height, body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`);
const text = (x, y, content, size, color, weight = 700, extra = "") =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${color}" ${extra}>${esc(content)}</text>`;
const slides = [
  { id: "01-timetable", label: "AUTO TIMETABLE", headline: ["Moodleに，", "見やすい時間割を。"],
    copy: ["シラバスから曜日・時限・教室を取得。", "いつものSafariで，授業をひと目に。"],
    image: "02-timetable-sample.png", bg: "#f7f2e8", accent: "#b8825b", ink: "#38271f" },
  { id: "02-customize", label: "MAKE IT YOURS", headline: ["教室も，メモも。", "自分の時間割に。"],
    copy: ["曜日・時限を直して，持ち物をメモ。", "科目の色も，自分らしく。"],
    image: "03-course-editor.png", bg: "#e8ede5", accent: "#829587", ink: "#293b30" },
  { id: "03-remember", label: "PICK UP WHERE YOU LEFT OFF", headline: ["開き直しても，", "前回の学期から。"],
    copy: ["選んだ学期を記憶して，次もそのまま。", "保存済みの科目を先に表示します。"],
    image: "05-spring-term.png", bg: "#38271f", accent: "#cba77e", ink: "#fff8ed", dark: true },
  { id: "04-sign-in", label: "LESS TYPING, MORE LEARNING", headline: ["毎回のログインを，", "もっとスムーズに。"],
    copy: ["保存したアカウントで入力を補助。", "パスワードはiOSのKeychainに保存。"],
    image: "01-guide.png", bg: "#f0e6d8", accent: "#9c7857", ink: "#38271f", guide: true },
  { id: "05-schedule", label: "YOUR DAY, YOUR SCHEDULE", headline: ["空きコマに，", "自分の予定も。"],
    copy: ["レポートや勉強の予定を，時間割に追加。", "授業と並べて，今日を組み立てる。"],
    image: "07-schedule-note.png", bg: "#f3e8e6", accent: "#bd8385", ink: "#503236" },
];

async function screen(source, width, height, radius) {
  return sharp(source).resize(width, height, { fit: "fill" })
    .composite([{ input: svg(width, height, `<rect width="${width}" height="${height}" rx="${radius}" fill="white"/>`), blend: "dest-in" }])
    .png().toBuffer();
}

async function compose(family, width, height) {
  const hashes = await Promise.all(slides.map(async (slide) => createHash("sha256")
    .update(await fs.readFile(path.join(SOURCES, family, slide.image))).digest("hex")));
  if (new Set(hashes).size !== slides.length) throw new Error(`${family}: expected distinct actual UI states`);
  const pad = family === "iPad-13";
  const x = pad ? 132 : 88;
  const brandY = pad ? 98 : 84;
  const brandSize = pad ? 66 : 52;
  const iconSize = pad ? 112 : 96;
  const titleSize = pad ? 110 : 88;
  const titleY = pad ? 376 : 366;
  const line = pad ? 148 : 120;
  const copyY = pad ? 636 : 618;
  const copySize = pad ? 42 : 33;
  const deviceWidth = pad ? 1400 : 884;
  const deviceHeight = Math.round(deviceWidth * (pad ? 2752 / 2064 : 2868 / 1320));
  const deviceX = Math.round((width - deviceWidth) / 2);
  const deviceY = pad ? 778 : 828;
  const border = pad ? 22 : 20;
  const corner = pad ? 52 : 104;
  const output = path.join(OUT, family);
  await fs.mkdir(output, { recursive: true });
  const icon = await sharp(path.join(ROOT, "Waseda Moodle Auto Login/Waseda Moodle Auto Login/Resources/Icon.png"))
    .resize(iconSize, iconSize).png().toBuffer();
  const results = [];
  for (const [index, slide] of slides.entries()) {
    const source = path.join(SOURCES, family, slide.image);
    const meta = await sharp(source).metadata();
    if (meta.width !== (pad ? 2064 : 1320) || meta.height !== (pad ? 2752 : 2868)) {
      throw new Error(`Unexpected real source dimensions: ${source}`);
    }
    const muted = slide.dark ? "#d0bdab" : "#76695d";
    let body = `<rect width="${width}" height="${height}" fill="${slide.bg}"/>
      <circle cx="${width * 0.9}" cy="${height * 0.73}" r="${width * 0.7}" fill="${slide.accent}" opacity=".11"/>
      <path d="M${width * .60} 0 V${height} M${width * .85} 0 V${height}" fill="none" stroke="${slide.ink}" stroke-opacity=".035" stroke-width="2"/>`;
    body += text(x + iconSize + 26, brandY + 49, "WasePlus", brandSize, slide.ink);
    body += text(x + iconSize + 28, brandY + 93, "SAFARI拡張  /  時間割とログイン", pad ? 27 : 23, muted, 600);
    body += text(x, pad ? 268 : 260, slide.label, pad ? 25 : 23, slide.dark ? "#d0b28d" : slide.accent, 700, 'letter-spacing="3"');
    body += slide.headline.map((t, i) => text(x, titleY + i * line, t, titleSize, slide.ink, 700, 'letter-spacing="-3"')).join("");
    body += slide.copy.map((t, i) => text(x + 2, copyY + i * (pad ? 65 : 55), t, copySize, muted, 500)).join("");
    body += `<ellipse cx="${width/2}" cy="${deviceY + deviceHeight + 26}" rx="${deviceWidth * .55}" ry="44" fill="#1c100a" opacity=".08"/>
      <rect x="${deviceX-border}" y="${deviceY-border}" width="${deviceWidth+border*2}" height="${deviceHeight+border*2}" rx="${corner + border}" fill="#27231f"/>
      <rect x="${deviceX-border+5}" y="${deviceY-border+5}" width="${deviceWidth+border*2-10}" height="${deviceHeight+border*2-10}" rx="${corner + border-4}" fill="none" stroke="#70665c" stroke-width="3"/>`;
    const footer = slide.guide ? "有効な大学アカウントが必要です。多要素認証は利用者が完了します。"
      : "Waseda Moodle用の非公式Safari機能拡張  ·  画面は架空のサンプルです";
    body += text(width/2, height-40, footer, pad ? 25 : 20, muted, 500, 'text-anchor="middle"');
    const image = await screen(source, deviceWidth, deviceHeight, corner);
    const target = path.join(output, `${slide.id}.png`);
    await sharp(svg(width, height, body)).composite([
      { input: icon, left: x, top: brandY }, { input: image, left: deviceX, top: deviceY },
    ]).flatten({ background: slide.bg }).removeAlpha().png().toFile(target);
    results.push({ file: path.relative(ROOT, target).replaceAll("\\", "/"), source: slide.image, width, height });
  }
  return results;
}

async function contactSheet(images, family) {
  const thumbWidth = family === "iPhone-6.9" ? 330 : 387;
  const gap = 20;
  const meta = await sharp(path.join(ROOT, images[0].file)).metadata();
  const thumbHeight = Math.round(thumbWidth * meta.height / meta.width);
  const tiles = [];
  for (const [i, item] of images.entries()) {
    tiles.push({ input: await sharp(path.join(ROOT, item.file)).resize(thumbWidth, thumbHeight).png().toBuffer(),
      left: gap + i*(thumbWidth+gap), top: gap });
  }
  await sharp({ create: { width: gap+(thumbWidth+gap)*images.length, height: thumbHeight+gap*2,
    channels: 3, background: "#ded5ca" } }).composite(tiles).png().toFile(path.join(OUT, `${family}-overview.png`));
}

(async () => {
  const report = [];
  for (const family of ["iPhone-6.9", "iPad-13"]) {
    const files = await compose(family, ...(family === "iPhone-6.9" ? [1320, 2868] : [2064, 2752]));
    await contactSheet(files, family);
    report.push({ family, files });
  }
  await fs.writeFile(path.join(OUT, "composition-report.json"), JSON.stringify({
    name: "WasePlus｜Safari拡張", subtitle: "時間割とログイン",
    note: "Real simulator sample UI, only scaled and framed. Fictional data; no institutional credentials.", report,
  }, null, 2) + "\n");
  console.log("PASS: ten opaque App Store layouts composed from actual iPhone and iPad UI");
})();
