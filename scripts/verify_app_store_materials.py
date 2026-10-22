"""Validate the approved local files before registering repository secrets."""
from datetime import datetime, timezone
from pathlib import Path
import plistlib
import sys

from cryptography import x509
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509.oid import NameOID

DIRECTORY = Path(__file__).resolve().parents[1] / ".secrets/app-store"


def main():
    password = sys.stdin.read().rstrip("\r\n").encode()
    key, certificate, _ = pkcs12.load_key_and_certificates((DIRECTORY / "distribution.p12").read_bytes(), password)
    del password
    expected = x509.load_pem_x509_certificate((DIRECTORY / "distribution-certificate.pem").read_bytes())
    assert key and certificate and certificate == expected, "P12 certificate mismatch"
    assert certificate.subject.get_attributes_for_oid(NameOID.ORGANIZATIONAL_UNIT_NAME)[0].value == "BBV3F75BKG"
    assert certificate.not_valid_after_utc > datetime.now(timezone.utc), "Distribution certificate expired"
    assert key.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo) == \
        certificate.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
    cert_der = certificate.public_bytes(serialization.Encoding.DER)
    for kind, bundle in (("app", "jp.yuto.campusssohelper"), ("extension", "jp.yuto.campusssohelper.Extension")):
        data = (DIRECTORY / f"{kind}.mobileprovision").read_bytes()
        start = data.index(b"<?xml")
        profile = plistlib.loads(data[start:data.index(b"</plist>", start) + len(b"</plist>")])
        entitlements = profile["Entitlements"]
        assert profile["TeamIdentifier"] == ["BBV3F75BKG"]
        assert entitlements["application-identifier"] == f"BBV3F75BKG.{bundle}"
        assert not entitlements.get("get-task-allow") and entitlements.get("beta-reports-active") is True
        assert not profile.get("ProvisionedDevices") and not profile.get("ProvisionsAllDevices")
        assert cert_der in profile["DeveloperCertificates"]
        assert profile["ExpirationDate"].replace(tzinfo=timezone.utc) > datetime.now(timezone.utc)
        print(f"PASS: {kind} App Store profile matches {bundle}; expires {profile['ExpirationDate'].isoformat()} UTC")
    print("PASS: approved P12 password, private key, certificate, team, and profiles match")


if __name__ == "__main__":
    main()
