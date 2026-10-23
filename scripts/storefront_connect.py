"""Read back the existing 2.1.0 listing through Apple's API; never mutate or submit it."""
import json
import argparse
from pathlib import Path

from app_store_connect import APP_ID, Client

VERSION = "2.1.0"
NAME = "WasePlus｜Safari拡張"
SUBTITLE = "時間割とログイン"


def context(client):
    app = client.request("GET", f"/apps/{APP_ID}")["data"]
    assert app["attributes"]["bundleId"] == "jp.yuto.campusssohelper"
    versions = client.request("GET", f"/apps/{APP_ID}/appStoreVersions?filter[platform]=IOS&limit=20")["data"]
    version = next(item for item in versions if item["attributes"]["versionString"] == VERSION)
    if version["attributes"]["appStoreState"] not in {"PREPARE_FOR_SUBMISSION", "READY_FOR_REVIEW"}:
        raise RuntimeError("The target version must still be an unsubmitted draft")
    app_infos = client.request("GET", f"/apps/{APP_ID}/appInfos")["data"]
    editable = [item for item in app_infos if item["attributes"]["appStoreState"] in
                {"PREPARE_FOR_SUBMISSION", "READY_FOR_REVIEW"}]
    if len(editable) != 1:
        raise RuntimeError("Expected exactly one editable app information resource")
    info = editable[0]
    app_locale = next(item for item in client.request("GET", f"/appInfos/{info['id']}/appInfoLocalizations")["data"]
                      if item["attributes"]["locale"] == "ja")
    version_locale = next(item for item in client.request("GET", f"/appStoreVersions/{version['id']}/appStoreVersionLocalizations")["data"]
                          if item["attributes"]["locale"] == "ja")
    return version, app_locale, version_locale



def inspect(client, version, app_locale, version_locale):
    sets = client.request("GET", f"/appStoreVersionLocalizations/{version_locale['id']}/appScreenshotSets?include=appScreenshots&limit=100")
    files = {v["id"]: {"fileName": v["attributes"]["fileName"],
                        "state": v["attributes"].get("assetDeliveryState")} for v in sets.get("included", [])}
    build = client.request("GET", f"/appStoreVersions/{version['id']}/build")["data"]
    previews = client.request("GET", f"/appStoreVersionLocalizations/{version_locale['id']}/appPreviewSets?include=appPreviews&limit=100")
    result = {"versionId": version["id"], "state": version["attributes"]["appStoreState"],
              "name": app_locale["attributes"]["name"], "subtitle": app_locale["attributes"].get("subtitle"),
              "build": build["attributes"]["version"] if build else None,
              "buildId": build["id"] if build else None,
              "versionLocaleId": version_locale["id"],
              "creditsInDescription": "Better Waseda Moodle" in version_locale["attributes"].get("description", ""),
              "trialVideosPublished": len(previews.get("included", [])),
              "screenshotSets": [{"id": item["id"], "displayType": item["attributes"]["screenshotDisplayType"],
                                  "files": [files.get(v["id"], v) for v in item["relationships"]["appScreenshots"]["data"]]}
                                 for item in sets["data"]]}
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--verify", action="store_true")
    args = parser.parse_args()
    client = Client()
    version, app_locale, version_locale = context(client)
    report = inspect(client, version, app_locale, version_locale)
    if args.output:
        args.output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=True))
    if args.verify:
        assert report["name"] == NAME and report["subtitle"] == SUBTITLE
        assert report["state"] == "READY_FOR_REVIEW" and report["build"] == "12"
        assert report["creditsInDescription"] and report["trialVideosPublished"] == 0
        targets = {"APP_IPHONE_67", "APP_IPAD_PRO_3GEN_129"}
        for item in report["screenshotSets"]:
            if item["displayType"] in targets:
                assert len(item["files"]) == 5
                assert all(f["state"]["state"] == "COMPLETE" for f in item["files"])
                targets.remove(item["displayType"])
        assert not targets
        print("PASS: expected listing, attribution, build and ten processed screenshots read back; videos remain unpublished")


if __name__ == "__main__":
    main()
