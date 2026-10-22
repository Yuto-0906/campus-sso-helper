// Caption actual simulator footage for user review. Does not upload a video.
const fs = require("node:fs/promises");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const sharp = require("sharp");
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "AppStoreAssets/Storefront-v2.1");
const CAPTURES = path.resolve(process.argv[2] || path.join(ROOT, "build/store-capture-final"));
const FFMPEG = process.env.FFMPEG || "ffmpeg";
const iconPath = path.join(ROOT, "Waseda Moodle Auto Login/Waseda Moodle Auto Login/Resources/Icon.png");
const font = "'Yu Gothic', 'Hiragino Sans', sans-serif";
const esc = (v) => v.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
const captions = [
  "Moodleに，見やすい時間割を。",
  "教室・時限・メモを自分好みに。",
  "学期を切り替えて，授業を確認。",
  "空きコマに，自分の予定も。",
  "Safariで使う，時間割とログイン。",
];
const boundaries = [0, 5.5, 14.5, 19.5, 24.8, 29];

function run(args) {
  const result = spawnSync(FFMPEG, ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`ffmpeg exited with ${result.status}`);
}

(async () => {
  await fs.mkdir(path.join(OUT, "Preview"), { recursive: true });
  const temp = path.join(ROOT, "build/preview-captions");
  await fs.mkdir(temp, { recursive: true });
  const report = [];
  const timingFile = path.join(CAPTURES, "preview-timing.json");
  const timing = await fs.readFile(timingFile, "utf8").then(JSON.parse).catch((error) => {
    if (error.code === "ENOENT") return {};
    throw error;
  });
  for (const [family, width, height] of [["iPhone-6.9", 886, 1920], ["iPad-13", 1200, 1600]]) {
    const pad = family === "iPad-13";
    const bannerH = pad ? 176 : 170;
    const icon = await sharp(iconPath).resize(48, 48).png().toBuffer();
    const layers = [];
    for (const [i, caption] of captions.entries()) {
      const body = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${bannerH}">
        <rect width="${width}" height="${bannerH}" fill="#38271f" fill-opacity=".97"/>
        <text x="90" y="51" font-family="${font}" font-size="31" font-weight="700" fill="#fff8ed">WasePlus</text>
        <text x="${width - 28}" y="48" text-anchor="end" font-family="${font}" font-size="22" fill="#d9c3a9">SAFARI拡張</text>
        <text x="30" y="123" font-family="${font}" font-size="${pad ? 43 : 37}" font-weight="700" fill="#fff8ed">${esc(caption)}</text>
        <rect y="${bannerH - 3}" width="${(i+1)*width/5}" height="3" fill="#cba77e"/>
      </svg>`;
      const filename = path.join(temp, `${family}-${i}.png`);
      await sharp(Buffer.from(body)).composite([{ input: icon, left: 28, top: 15 }]).png().toFile(filename);
      layers.push(filename);
    }
    const target = path.join(OUT, "Preview", `WasePlus-${family}-trial.mp4`);
    // Keep the full UI in frame; only the status/nav area receives a caption.
    const startSeconds = timing[family]?.startSeconds || 0;
    const args = ["-i", path.join(CAPTURES, family, "sample-recording.mov")];
    for (const filename of layers) args.push("-i", filename);
    const filters = [`[0:v]scale=${width}:${height}:flags=lanczos,fps=30,trim=start=${startSeconds}:duration=29,setpts=PTS-STARTPTS,setsar=1[base]`];
    let previous = "base";
    for (let i = 0; i < layers.length; i++) {
      filters.push(`[${previous}][${i+1}:v]overlay=0:0:enable='between(t,${boundaries[i]},${boundaries[i+1]})'[step${i}]`);
      previous = `step${i}`;
    }
    args.push("-filter_complex", filters.join(";"), "-map", `[${previous}]`, "-t", "29", "-an",
      "-c:v", "libx264", "-profile:v", "high", "-level:v", "4.0", "-pix_fmt", "yuv420p",
      "-b:v", "10M", "-maxrate", "12M", "-bufsize", "20M", "-movflags", "+faststart", target);
    run(args);
    run(["-ss", "1", "-i", target, "-frames:v", "1", path.join(OUT, "Preview", `WasePlus-${family}-poster.png`)]);
    report.push({ family, file: path.relative(ROOT, target).replaceAll("\\", "/"), width, height, startSeconds,
      status: "trial only; awaiting the user's judgment; not uploaded to App Store Connect",
      footage: "Actual simulator offline sample UI; fictional courses; no account credentials or external music" });
  }
  await fs.writeFile(path.join(OUT, "Preview", "preview-report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log("PASS: captioned iPhone and iPad video trials created; nothing uploaded");
})();
