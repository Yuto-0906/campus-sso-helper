// Rasterize the app's own vector artwork without changing its geometry.
const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");

(async () => {
  const root = path.resolve(__dirname, "..");
  const svg = await fs.readFile(path.join(root, "extension/icons/icon.svg"));
  const app = path.join(root, "Waseda Moodle Auto Login/Waseda Moodle Auto Login");
  const targets = [["Resources/Icon.png", 512], ["Assets.xcassets/AppIcon.appiconset/universal-icon-1024@1x.png", 1024]];
  for (const [suffix, scale] of [["", 1], ["@2x", 2], ["@3x", 3]]) {
    targets.push([`Assets.xcassets/LargeIcon.imageset/LargeIcon${suffix}.png`, 128 * scale]);
    targets.push([`Assets.xcassets/LargeIcon.imageset/LargeIconDark${suffix}.png`, 128 * scale]);
  }
  for (const [relative, size] of targets) {
    await sharp(svg).resize(size, size).flatten({ background: "#38271f" }).removeAlpha().png()
      .toFile(path.join(app, relative));
  }
  console.log("PASS: calendar and sign-in icon rendered for all app icon assets");
})();
