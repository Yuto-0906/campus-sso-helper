"""Use the approved local API key; never print keys, JWTs, or HTTP headers."""
import argparse
import base64
from datetime import datetime, timezone
import json
from pathlib import Path
import time
import urllib.error
import urllib.parse
import urllib.request

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, utils

ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = ROOT / ".secrets/app-store"
APP_ID = "6791983170"
BUNDLE_ID = "jp.yuto.campusssohelper"


def b64url(value):
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode()


class Client:
    def __init__(self):
        self.config = json.loads((DIRECTORY / "api-config.json").read_text())
        self.key = serialization.load_pem_private_key((DIRECTORY / "AuthKey.p8").read_bytes(), None)
        if not isinstance(self.key, ec.EllipticCurvePrivateKey) or self.key.curve.name != "secp256r1":
            raise ValueError("The App Store Connect key must use P-256")

    def request(self, method, path, data=None):
        if not path.startswith("/") or path.startswith("//"):
            raise ValueError("Expected an Apple API path")
        now = int(time.time())
        header = {"alg": "ES256", "kid": self.config["keyId"], "typ": "JWT"}
        claims = {"iss": self.config["issuerId"], "iat": now - 10, "exp": now + 600, "aud": "appstoreconnect-v1"}
        message = ".".join(b64url(json.dumps(v, separators=(",", ":")).encode()) for v in (header, claims))
        r, s = utils.decode_dss_signature(self.key.sign(message.encode(), ec.ECDSA(hashes.SHA256())))
        token = message + "." + b64url(r.to_bytes(32, "big") + s.to_bytes(32, "big"))
        request = urllib.request.Request("https://api.appstoreconnect.apple.com/v1" + path,
            data=json.dumps(data).encode() if data is not None else None, method=method,
            headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                body = response.read()
                return json.loads(body) if body else {}
        except urllib.error.HTTPError as error:
            try:
                errors = json.loads(error.read()).get("errors", [])
                details = "; ".join(str(e.get("title", "")) + ": " + str(e.get("detail", "")) for e in errors)
            except (ValueError, TypeError):
                details = "Apple API request failed"
            raise RuntimeError(f"Apple API HTTP {error.code}: {details[:1000]}") from None


def prepare_profiles(client):
    pem = (DIRECTORY / "distribution-certificate.pem").read_bytes()
    certificate = x509.load_pem_x509_certificate(pem).public_bytes(serialization.Encoding.DER)
    certificates = client.request("GET", "/certificates?limit=200")["data"]
    match = next(c for c in certificates if base64.b64decode(c["attributes"]["certificateContent"]) == certificate)
    cert_id = match["id"]
    print("PASS: the existing Apple Distribution identity matches this Apple account")
    profiles = client.request("GET", "/profiles?filter[profileType]=IOS_APP_STORE&include=bundleId,certificates&limit=200")["data"]
    for kind, identifier in (("app", BUNDLE_ID), ("extension", BUNDLE_ID + ".Extension")):
        bundles = client.request("GET", "/bundleIds?" + urllib.parse.urlencode({"filter[identifier]": identifier}))["data"]
        bundle = next(b for b in bundles if b["attributes"]["identifier"] == identifier)
        valid = [p for p in profiles if p["attributes"]["profileState"] == "ACTIVE"
                 and p["relationships"]["bundleId"]["data"]["id"] == bundle["id"]
                 and any(c["id"] == cert_id for c in p["relationships"]["certificates"]["data"])
                 and datetime.fromisoformat(p["attributes"]["expirationDate"].replace("Z", "+00:00")) > datetime.now(timezone.utc)]
        if valid:
            profile = valid[0]
        else:
            profile = client.request("POST", "/profiles", {"data": {"type": "profiles", "attributes": {
                "name": f"Campus SSO Helper {kind} App Store 2026-10-22", "profileType": "IOS_APP_STORE"},
                "relationships": {"bundleId": {"data": {"type": "bundleIds", "id": bundle["id"]}},
                    "certificates": {"data": [{"type": "certificates", "id": cert_id}]}}}})["data"]
        (DIRECTORY / f"{kind}.mobileprovision").write_bytes(base64.b64decode(profile["attributes"]["profileContent"]))
        print(f"PASS: {kind} App Store profile prepared for {identifier}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["status", "prepare-profiles", "builds"])
    args = parser.parse_args()
    client = Client()
    if args.action == "prepare-profiles":
        prepare_profiles(client)
    elif args.action == "builds":
        builds = client.request("GET", f"/builds?filter[app]={APP_ID}&include=preReleaseVersion&sort=-uploadedDate&limit=15")
        versions = {v["id"]: v["attributes"]["version"] for v in builds.get("included", []) if v["type"] == "preReleaseVersions"}
        for build in builds["data"]:
            version_id = build.get("relationships", {}).get("preReleaseVersion", {}).get("data", {}).get("id")
            a = build["attributes"]
            print(json.dumps({"id": build["id"], "version": versions.get(version_id), "build": a["version"],
                "processingState": a["processingState"], "uploadedDate": a["uploadedDate"]}))
    else:
        app = client.request("GET", f"/apps/{APP_ID}")["data"]
        assert app["attributes"]["bundleId"] == BUNDLE_ID
        versions = client.request("GET", f"/apps/{APP_ID}/appStoreVersions?filter[platform]=IOS&limit=10")["data"]
        print(json.dumps({"app": app["attributes"]["name"], "bundleId": BUNDLE_ID,
            "versions": [{"id": v["id"], "version": v["attributes"]["versionString"],
                          "state": v["attributes"].get("appStoreState")} for v in versions]}))


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, ValueError, StopIteration) as error:
        raise SystemExit(str(error) or "No matching Apple signing identity was found")
