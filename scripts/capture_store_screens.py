"""Capture real simulator UI with fictional data and no institutional sign-in."""
import json
import os
from pathlib import Path
import signal
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
BUNDLE_ID = "jp.yuto.campusssohelper"


def run(*args):
    return subprocess.check_output(args, cwd=ROOT, text=True).strip()


def capture_sample(identifier, target, video=False):
    """Drive real sample controls and verify native checkpoint messages before capture."""
    script = (ROOT / "scripts/store-preview.js").read_text()
    mode = "video" if video else "stills"
    env = {**os.environ, "SIMCTL_CHILD_CSH_STORE_PREVIEW_SCRIPT":
           f"globalThis.CSH_PREVIEW_MODE = '{mode}';\n" + script}
    subprocess.run(["xcrun", "simctl", "terminate", identifier, BUNDLE_ID], capture_output=True)
    recorder = None
    if video:
        recorder = subprocess.Popen(["xcrun", "simctl", "io", identifier, "recordVideo", "--codec=h264",
                                     "--force", str(target / "sample-recording.mov")],
                                    stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        time.sleep(1)
    log_path = target / f"{mode}-capture.log"
    stages = {"timetable": "02-timetable-sample.png", "editor": "03-course-editor.png",
              "saved": "04-course-note.png", "spring": "05-spring-term.png",
              "note-editor": "06-note-editor.png", "note-saved": "07-schedule-note.png"}
    seen = set()
    try:
        with log_path.open("w") as log:
            process = subprocess.Popen(["xcrun", "simctl", "launch", "--console", identifier,
                                        BUNDLE_ID, "--timetable-sample"],
                                       cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT)
            try:
                deadline = time.monotonic() + 65
                while time.monotonic() < deadline:
                    content = log_path.read_text(errors="replace")
                    if "STORE_PREVIEW:error:" in content:
                        raise RuntimeError(content.split("STORE_PREVIEW:error:", 1)[1].splitlines()[0])
                    for stage, filename in stages.items():
                        if stage not in seen and f"STORE_PREVIEW:{stage}\n" in content:
                            seen.add(stage)
                            if not video:
                                run("xcrun", "simctl", "io", identifier, "screenshot", str(target / filename))
                    if "STORE_PREVIEW:complete" in content:
                        break
                    time.sleep(0.15)
                else:
                    raise RuntimeError("Sample capture timed out before its final checkpoint")
                if seen != set(stages):
                    raise RuntimeError(f"Missing actual UI checkpoints: {set(stages) - seen}")
            finally:
                subprocess.run(["xcrun", "simctl", "terminate", identifier, BUNDLE_ID], capture_output=True)
                try:
                    process.wait(timeout=8)
                except subprocess.TimeoutExpired:
                    process.terminate()
                    process.wait(timeout=8)
    finally:
        if recorder:
            recorder.send_signal(signal.SIGINT)
            _, error = recorder.communicate(timeout=15)
            if recorder.returncode != 0:
                raise RuntimeError(f"Simulator recording failed: {error.decode(errors='replace')[-800:]}")
    return sorted(seen)


def main():
    derived = ROOT / "build/store-simulator"
    run("xcodebuild", "-quiet", "-project", "Waseda Moodle Auto Login/Waseda Moodle Auto Login.xcodeproj",
        "-scheme", "Waseda Moodle Auto Login", "-configuration", "Debug",
        "-destination", "generic/platform=iOS Simulator", "-derivedDataPath", str(derived),
        "CODE_SIGNING_ALLOWED=NO", "build")
    app = derived / "Build/Products/Debug-iphonesimulator/Waseda Moodle Auto Login.app"
    devices = json.loads(run("xcrun", "simctl", "list", "devices", "available", "--json"))["devices"]
    runtimes = sorted((r for r in devices if ".iOS-" in r),
                      key=lambda r: tuple(int(n) for n in r.split(".iOS-")[1].split("-")), reverse=True)
    output = ROOT / "build/store-screenshots"
    report = []
    for family, match in (("iPhone-6.9", lambda n: "iPhone" in n and "Pro Max" in n),
                          ("iPad-13", lambda n: "iPad Pro" in n and "13-inch" in n)):
        selected = next(((r, d) for r in runtimes for d in devices[r] if match(d["name"])), None)
        if not selected:
            raise RuntimeError(f"No available {family} simulator")
        runtime, device = selected
        identifier = device["udid"]
        if device["state"] != "Booted":
            run("xcrun", "simctl", "boot", identifier)
        run("xcrun", "simctl", "bootstatus", identifier, "-b")
        run("xcrun", "simctl", "status_bar", identifier, "override", "--time", "9:41",
            "--dataNetwork", "wifi", "--wifiMode", "active", "--wifiBars", "3",
            "--batteryState", "charged", "--batteryLevel", "100")
        run("xcrun", "simctl", "ui", identifier, "appearance", "light")
        run("xcrun", "simctl", "install", identifier, str(app))
        target = output / family
        target.mkdir(parents=True, exist_ok=True)
        run("xcrun", "simctl", "launch", identifier, BUNDLE_ID)
        time.sleep(5)
        run("xcrun", "simctl", "io", identifier, "screenshot", str(target / "01-guide.png"))
        stages = capture_sample(identifier, target)
        capture_sample(identifier, target, video=True)
        report.append({"family": family, "device": device["name"], "runtime": runtime,
                       "data": "fictional offline sample", "checkpoints": stages,
                       "recording": "sample-recording.mov", "source": run("git", "rev-parse", "HEAD")})
        run("xcrun", "simctl", "shutdown", identifier)
    (output / "capture-report.json").write_text(json.dumps(report, indent=2) + "\n")
    print("PASS: actual guide, course editing, term selection and schedule notes captured on iPhone and iPad")


if __name__ == "__main__":
    main()
