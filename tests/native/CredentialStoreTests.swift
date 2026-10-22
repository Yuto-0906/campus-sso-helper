import Foundation
import Security

@main
struct CredentialStoreTests {
    static func main() throws {
        func expect(_ actual: String?, _ expected: String?) { precondition(actual == expected) }
        let service = "jp.yuto.campusssohelper.tests.\(UUID().uuidString)"
        let store = CredentialStore(service: service)
        defer { try? store.remove() }
        expect(try store.load(), nil)
        try store.save("fixture-one")
        expect(try store.load(), "fixture-one")
        try store.save("stale-legacy", overwrite: false)
        expect(try store.load(), "fixture-one")
        try store.save("fixture-two")
        expect(try store.load(), "fixture-two")
        var result: CFTypeRef?
        let status = SecItemCopyMatching([
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecReturnAttributes as String: true
        ] as CFDictionary, &result)
        assert(status == errSecSuccess)
        // macOS command-line tests use the legacy login keychain, which does not
        // expose iOS accessibility attributes. iOS uses the data-protection store.
        #if os(iOS)
        let attributes = result as! [String: Any]
        assert(attributes[kSecAttrAccessible as String] as? String == kSecAttrAccessibleWhenUnlockedThisDeviceOnly as String)
        #endif
        do {
            try store.save("")
            assertionFailure("Empty password must be rejected")
        } catch CredentialStore.StoreError.invalidPassword { }
        try store.remove()
        expect(try store.load(), nil)
        try store.remove()
        print("PASS: native Keychain create, read, update, migration, delete")
    }
}
