"""Build and verify a development or App Store IPA in GitHub Actions.

Signing material is used only in an ephemeral macOS keychain and is never logged.
"""

import base64
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import plistlib
import re
import secrets
import shlex
import shutil
import subprocess
import sys
import tempfile


ROOT = Path(__file__).resolve().parents[1]
TEAM_ID = "BBV3F75BKG"
APP_ID = "jp.yuto.campusssohelper"
EXTENSION_ID = "jp.yuto.campusssohelper.Extension"
SECRETS = (
    "APPLE_DEVELOPMENT_P12_BASE64",
    "APPLE_DEVELOPMENT_P12_PASSWORD",
    "IOS_APP_PROFILE_BASE64",
    "IOS_EXTENSION_PROFILE_BASE64",
)
STORE_SECRETS = (
    "APPLE_DISTRIBUTION_P12_BASE64", "APPLE_DISTRIBUTION_P12_PASSWORD",
    "IOS_APP_STORE_PROFILE_BASE64", "IOS_EXTENSION_APP_STORE_PROFILE_BASE64",
)


def cleanup(directory: Path) -> None:
    runner_temp = Path(os.environ["RUNNER_TEMP"]).resolve()
    directory = directory.resolve()
    if directory.parent != runner_temp or not directory.name.startswith("campus-sso-signing-"):
        raise ValueError("Refusing to clean outside this signing job")
    if not directory.exists():
        return
    originals = directory / "original-keychains.json"
    if originals.exists():
        subprocess.run(
            ["security", "list-keychains", "-d", "user", "-s", *json.loads(originals.read_text())],
            capture_output=True,
        )
    keychain = directory / "signing.keychain-db"
    if keychain.exists():
        subprocess.run(["security", "delete-keychain", str(keychain)], capture_output=True)
    installed = directory / "installed-profiles.json"
    if installed.exists():
        for name in json.loads(installed.read_text()):
            if not re.fullmatch(r"[A-Fa-f0-9-]{36}\.mobileprovision", name):
                raise ValueError("Invalid installed profile filename")
            (Path.home() / "Library/MobileDevice/Provisioning Profiles" / name).unlink(missing_ok=True)
    shutil.rmtree(directory)


def main(app_store: bool = False, upload: bool = False) -> None:
    secret_names = STORE_SECRETS if app_store else SECRETS
    materials = {name: os.environ.pop(name, "") for name in secret_names}
    if not all(materials.values()):
        raise ValueError("All four approved signing secrets are required")
    directory = Path(tempfile.mkdtemp(prefix="campus-sso-signing-", dir=os.environ["RUNNER_TEMP"]))
    with open(os.environ["GITHUB_ENV"], "a", encoding="utf-8") as stream:
        stream.write(f"CAMPUS_SSO_SIGNING_TEMP={directory}\n")
    keychain = directory / "signing.keychain-db"
    keychain_password = secrets.token_urlsafe(40)
    passwords = (materials[secret_names[1]], keychain_password)

    def run(args: list[str], cwd: Path = ROOT) -> bytes:
        result = subprocess.run(args, cwd=cwd, capture_output=True)
        if result.returncode:
            diagnostic = (result.stdout + b"\n" + result.stderr).decode("utf-8", errors="replace")
            for password in passwords:
                diagnostic = diagnostic.replace(password, "[redacted]")
            diagnostic = re.sub(r"\b[0-9A-Fa-f]{8}-[0-9A-Fa-f]{16}\b", "[device-id]", diagnostic)
            safe_lines = [line for line in diagnostic.splitlines()
                          if "error:" in line.lower() or line.startswith("security:")]
            raise RuntimeError(f"{Path(args[0]).name} failed ({result.returncode}): " + "\n".join(safe_lines[-20:]))
        return result.stdout

    try:
        paths = {
            "p12": directory / "development.p12",
            "app": directory / "app.mobileprovision",
            "extension": directory / "extension.mobileprovision",
        }
        paths["p12"].write_bytes(base64.b64decode(materials.pop(secret_names[0]), validate=True))
        paths["app"].write_bytes(base64.b64decode(materials.pop(secret_names[2]), validate=True))
        paths["extension"].write_bytes(base64.b64decode(materials.pop(secret_names[3]), validate=True))
        for path in paths.values():
            path.chmod(0o600)

        profiles = {
            kind: plistlib.loads(run(["security", "cms", "-D", "-i", str(paths[kind])]))
            for kind in ("app", "extension")
        }
        expected_ids = {"app": APP_ID, "extension": EXTENSION_ID}
        expiry = {}
        device_sets = []
        for kind, profile in profiles.items():
            entitlements = profile["Entitlements"]
            prefix = profile["ApplicationIdentifierPrefix"][0]
            expiry[kind] = profile["ExpirationDate"].replace(tzinfo=timezone.utc)
            if profile["TeamIdentifier"] != [TEAM_ID] or entitlements.get("com.apple.developer.team-identifier") != TEAM_ID:
                raise ValueError(f"{kind} profile team mismatch")
            if entitlements.get("application-identifier") != f"{prefix}.{expected_ids[kind]}":
                raise ValueError(f"{kind} profile Bundle ID mismatch")
            if app_store:
                if entitlements.get("get-task-allow") is True or profile.get("ProvisionedDevices") or \
                        profile.get("ProvisionsAllDevices") or entitlements.get("beta-reports-active") is not True:
                    raise ValueError(f"{kind} is not an App Store distribution profile")
            elif entitlements.get("get-task-allow") is not True or not profile.get("ProvisionedDevices"):
                raise ValueError(f"{kind} is not an iOS development profile")
            if expiry[kind] <= datetime.now(timezone.utc):
                raise ValueError(f"{kind} profile expired")
            if not re.fullmatch(r"[A-Fa-f0-9-]{36}", profile["UUID"]):
                raise ValueError(f"{kind} profile UUID invalid")
            device_sets.append(set(profile.get("ProvisionedDevices", [])))
        if not app_store and (not device_sets[0] or device_sets[0] != device_sets[1]):
            raise ValueError("App and extension profiles must list the same registered devices")
        print("PASS: app and extension profiles match the requested distribution method", flush=True)

        original_keychains = shlex.split(run(["security", "list-keychains", "-d", "user"]).decode())
        (directory / "original-keychains.json").write_text(json.dumps(original_keychains))
        run(["security", "create-keychain", "-p", keychain_password, str(keychain)])
        run(["security", "set-keychain-settings", "-lut", "21600", str(keychain)])
        run(["security", "unlock-keychain", "-p", keychain_password, str(keychain)])
        run(["security", "list-keychains", "-d", "user", "-s", str(keychain), *original_keychains])
        run(["security", "import", str(paths["p12"]), "-P", materials.pop(secret_names[1]), "-k", str(keychain),
             "-T", "/usr/bin/codesign", "-T", "/usr/bin/security"])
        run(["security", "set-key-partition-list", "-S", "apple-tool:,apple:,codesign:",
             "-s", "-k", keychain_password, str(keychain)])
        identities = run(["security", "find-identity", "-v", "-p", "codesigning", str(keychain)]).decode()
        fingerprints = set(re.findall(r"\b[A-F0-9]{40}\b", identities))
        matching = [cert for cert in profiles["app"]["DeveloperCertificates"]
                    if hashlib.sha1(cert).hexdigest().upper() in fingerprints]
        if len(matching) != 1 or matching[0] not in profiles["extension"]["DeveloperCertificates"]:
            raise ValueError("The P12 certificate must be present in both profiles")
        identity = hashlib.sha1(matching[0]).hexdigest().upper()
        print("PASS: signing identity matches both provisioning profiles", flush=True)

        profile_directory = Path.home() / "Library/MobileDevice/Provisioning Profiles"
        profile_directory.mkdir(parents=True, exist_ok=True)
        installed = []
        for kind, profile in profiles.items():
            destination = profile_directory / f"{profile['UUID']}.mobileprovision"
            if destination.exists():
                raise ValueError("Refusing to overwrite an existing provisioning profile")
            shutil.copy2(paths[kind], destination)
            destination.chmod(0o600)
            installed.append(destination.name)
            (directory / "installed-profiles.json").write_text(json.dumps(installed))

        project = ROOT / "Waseda Moodle Auto Login/Waseda Moodle Auto Login.xcodeproj"
        derived = ROOT / "build/signed-device"
        archive = ROOT / "build/CampusSSOHelper.xcarchive"
        command = ["xcodebuild", "-quiet", "-project", str(project), "-scheme", "Waseda Moodle Auto Login",
             "-configuration", "Release" if app_store else "Debug", "-destination", "generic/platform=iOS", "-derivedDataPath", str(derived),
             "CODE_SIGN_STYLE=Manual", f"DEVELOPMENT_TEAM={TEAM_ID}", f"CODE_SIGN_IDENTITY={identity}",
             f"IOS_APP_PROFILE_UUID={profiles['app']['UUID']}",
             f"IOS_EXTENSION_PROFILE_UUID={profiles['extension']['UUID']}",
             f"OTHER_CODE_SIGN_FLAGS=--keychain {keychain}"]
        if app_store:
            command += ["-archivePath", str(archive), "archive"]
        else:
            command += ["build"]
        run(command)
        print("PASS: signed iOS device build", flush=True)

        exported_ipa = None
        if app_store:
            options = directory / "ExportOptions.plist"
            options.write_bytes(plistlib.dumps({
                "method": "app-store-connect", "signingStyle": "manual", "teamID": TEAM_ID,
                "signingCertificate": identity, "manageAppVersionAndBuildNumber": False,
                "provisioningProfiles": {expected_ids[kind]: profile["UUID"] for kind, profile in profiles.items()},
            }))
            exported = ROOT / "build/app-store-export"
            run(["xcodebuild", "-quiet", "-exportArchive", "-archivePath", str(archive),
                 "-exportOptionsPlist", str(options), "-exportPath", str(exported)])
            exported_ipa = next(exported.glob("*.ipa"))
            run(["ditto", "-x", "-k", str(exported_ipa), str(directory / "exported")])
            app = directory / "exported/Payload/Waseda Moodle Auto Login.app"
        else:
            app = derived / "Build/Products/Debug-iphoneos/Waseda Moodle Auto Login.app"
        extension = app / "PlugIns/Waseda Moodle Auto Login Extension.appex"
        if not app.is_dir() or not extension.is_dir():
            raise ValueError("Signed app or Safari extension is missing")
        for kind, bundle in (("app", app), ("extension", extension)):
            run(["codesign", "--verify", "--deep", "--strict", str(bundle)])
            info = plistlib.loads((bundle / "Info.plist").read_bytes())
            if info["CFBundleIdentifier"] != expected_ids[kind]:
                raise ValueError(f"{kind} signed Bundle ID mismatch")
            if info["CFBundleSupportedPlatforms"] != ["iPhoneOS"]:
                raise ValueError(f"{kind} is not an iOS device binary")
            if kind == "app" and set(info["UIDeviceFamily"]) != {1, 2}:
                raise ValueError("App must support iPhone and iPad")
            signed = plistlib.loads(run(["codesign", "-d", "--entitlements", ":-", str(bundle)]))
            expected = profiles[kind]["Entitlements"]
            for name in ("application-identifier", "com.apple.developer.team-identifier", "get-task-allow"):
                actual_value = bool(signed.get(name)) if name == "get-task-allow" else signed.get(name)
                expected_value = bool(expected.get(name)) if name == "get-task-allow" else expected.get(name)
                if actual_value != expected_value:
                    raise ValueError(f"{kind} signed entitlement mismatch: {name}")
            embedded = plistlib.loads(run(["security", "cms", "-D", "-i", str(bundle / "embedded.mobileprovision")]))
            if embedded["UUID"] != profiles[kind]["UUID"]:
                raise ValueError(f"{kind} embedded profile mismatch")
        print("PASS: app and extension signatures, entitlements and embedded profiles verified", flush=True)

        if not (app / "legal/licenses.html").is_file() or not (app / "legal/privacy.html").is_file():
            raise ValueError("Bundled license or privacy policy is missing")
        output = ROOT / "build/ipa"
        output.mkdir(parents=True, exist_ok=True)
        version = plistlib.loads((app / "Info.plist").read_bytes())
        ipa = output / f"CampusSSOHelper-{version['CFBundleShortVersionString']}-build{version['CFBundleVersion']}.ipa"
        if exported_ipa:
            shutil.copyfile(exported_ipa, ipa)
        else:
            payload = directory / "Payload"
            payload.mkdir()
            run(["ditto", str(app), str(payload / app.name)])
            run(["ditto", "-c", "-k", "--keepParent", str(payload), str(ipa)])
        digest = hashlib.sha256(ipa.read_bytes()).hexdigest()
        (output / f"{ipa.name}.sha256").write_text(f"{digest}  {ipa.name}\n")
        report = {
            "commit": os.environ["GITHUB_SHA"], "runId": os.environ["GITHUB_RUN_ID"],
            "appBundleId": APP_ID, "extensionBundleId": EXTENSION_ID,
            "version": version["CFBundleShortVersionString"], "build": version["CFBundleVersion"],
            "platform": "iPhoneOS", "signatureVerified": True,
            "distribution": "app-store" if app_store else "development", "uploadedToAppStoreConnect": False,
            "appProfileExpiresUTC": expiry["app"].isoformat(),
            "extensionProfileExpiresUTC": expiry["extension"].isoformat(), "sha256": digest,
        }
        if upload:
            key_id = os.environ.pop("APP_STORE_CONNECT_KEY_ID", "").strip()
            issuer = os.environ.pop("APP_STORE_CONNECT_ISSUER_ID", "").strip()
            encoded_key = os.environ.pop("APP_STORE_CONNECT_P8_BASE64", "")
            if not app_store or not re.fullmatch(r"[A-Z0-9]{10}", key_id) or not re.fullmatch(r"[a-fA-F0-9-]{36}", issuer):
                raise ValueError("App Store upload credentials are missing or invalid")
            keys = directory / "private_keys"
            keys.mkdir(mode=0o700)
            key_file = keys / f"AuthKey_{key_id}.p8"
            key_file.write_bytes(base64.b64decode(encoded_key, validate=True))
            key_file.chmod(0o600)
            run(["xcrun", "altool", "--upload-app", "--type", "ios", "-f", str(ipa),
                 "--apiKey", key_id, "--apiIssuer", issuer], cwd=directory)
            report["uploadedToAppStoreConnect"] = True
            print("PASS: IPA uploaded to App Store Connect; no review submission requested", flush=True)
        (output / "build-report.json").write_text(json.dumps(report, indent=2) + "\n")
        print(f"PASS: {report['distribution']} IPA created for {APP_ID} {report['version']} ({report['build']})")
    finally:
        materials.clear()
        cleanup(directory)


if __name__ == "__main__":
    try:
        if sys.argv[1:] == ["--cleanup"]:
            if os.environ.get("CAMPUS_SSO_SIGNING_TEMP"):
                cleanup(Path(os.environ["CAMPUS_SSO_SIGNING_TEMP"]))
        elif len(sys.argv) == 1:
            main()
        elif sys.argv[1:] == ["--app-store", "--upload"]:
            main(app_store=True, upload=True)
        elif sys.argv[1:] == ["--app-store"]:
            main(app_store=True)
        else:
            raise ValueError("Unexpected arguments")
    except (ValueError, KeyError, RuntimeError) as error:
        raise SystemExit(f"Signing failed: {error}")
