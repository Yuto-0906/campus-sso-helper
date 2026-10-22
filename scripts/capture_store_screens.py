"""Capture real simulator UI with fictional data and no institutional sign-in."""
import json
from pathlib import Path
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
BUNDLE_ID = "jp.yuto.campusssohelper"


def run(*args):
    return subprocess.check_output(args, cwd=ROOT, text=True).strip()


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
        for filename, arguments in (("01-guide.png", []), ("02-timetable-sample.png", ["--timetable-sample"])):
            subprocess.run(["xcrun", "simctl", "terminate", identifier, BUNDLE_ID], capture_output=True)
            run("xcrun", "simctl", "launch", identifier, BUNDLE_ID, *arguments)
            time.sleep(4)
            run("xcrun", "simctl", "io", identifier, "screenshot", str(target / filename))
        report.append({"family": family, "device": device["name"], "runtime": runtime,
                       "data": "fictional offline sample"})
        run("xcrun", "simctl", "shutdown", identifier)
    (output / "capture-report.json").write_text(json.dumps(report, indent=2) + "\n")
    print("PASS: containing app and offline timetable captured on iPhone and iPad")


if __name__ == "__main__":
    main()
