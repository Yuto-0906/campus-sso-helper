"""Keep the app's bundled resources in sync with the reviewed source files."""
from html import escape
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "Waseda Moodle Auto Login/Waseda Moodle Auto Login/Resources"
EXTENSION = ROOT / "Waseda Moodle Auto Login/Waseda Moodle Auto Login Extension/Resources"

for source in (ROOT / "extension").rglob("*"):
    if source.is_file():
        target = EXTENSION / source.relative_to(ROOT / "extension")
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)

legal = APP / "legal"
legal.mkdir(exist_ok=True)
policy = (ROOT / "docs/privacy.html").read_text(encoding="utf-8")
(legal / "privacy.html").write_text(policy.replace('href="./"', 'href="../Base.lproj/Main.html"'), encoding="utf-8")
shutil.copyfile(ROOT / "docs/styles.css", legal / "styles.css")
notice = (ROOT / "THIRD_PARTY_NOTICES.md").read_text(encoding="utf-8")
license_text = notice[notice.index("MIT License"):].strip()
(legal / "licenses.html").write_text('''<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>オープンソースライセンス | WasePlus</title><link rel="stylesheet" href="styles.css"></head>
<body><header class="page-header"><nav class="nav"><a class="brand" href="../Base.lproj/Main.html">WasePlus</a></nav>
<h1>オープンソースライセンス</h1></header><main class="policy"><section><h2>Better Waseda Moodle</h2>
<p>時間割の科目取得方法，シラバス検索フォーム，学期の扱いは，mkihr-ojisan氏のBetter Waseda Moodleの仕様と公開実装（v0.9.5，MIT License）を参考に，iOS向けに実装しています。</p>
<p><a href="https://github.com/mkihr-ojisan/better-waseda-moodle">参考元の公開リポジトリ</a></p>
<pre style="white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:1.7">''' + escape(license_text) + '''</pre>
</section></main></body></html>''', encoding="utf-8")
print("PASS: extension resources, bundled privacy policy and complete MIT license synchronized")
for name in ("timetable-core.js", "timetable.js", "timetable.css"):
    shutil.copyfile(ROOT / "extension" / name, APP / "demo" / name)
