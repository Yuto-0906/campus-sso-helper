import Foundation
import Security

/// A device-only password item owned by the Safari extension's signing identity.
final class CredentialStore {
    private let service: String
    private let account = "microsoft-password"

    init(service: String = "jp.yuto.campusssohelper.credentials") {
        self.service = service
    }

    private var query: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: service,
         kSecAttrAccount as String: account]
    }

    enum StoreError: Error {
        case invalidPassword
        case keychain(OSStatus)
    }

    func load() throws -> String? {
        var request = query
        request[kSecReturnData as String] = true
        request[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(request as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess else { throw StoreError.keychain(status) }
        guard let data = result as? Data,
              let password = String(data: data, encoding: .utf8) else {
            throw StoreError.invalidPassword
        }
        return password
    }

    func save(_ password: String, overwrite: Bool = true) throws {
        guard !password.isEmpty, password.utf8.count <= 4096 else {
            throw StoreError.invalidPassword
        }
        if !overwrite, try load() != nil { return }
        let attributes: [String: Any] = [
            kSecValueData as String: Data(password.utf8),
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]
        let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var item = query
            item.merge(attributes) { _, value in value }
            let added = SecItemAdd(item as CFDictionary, nil)
            guard added == errSecSuccess else { throw StoreError.keychain(added) }
        } else if status != errSecSuccess {
            throw StoreError.keychain(status)
        }
    }

    func remove() throws {
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw StoreError.keychain(status)
        }
    }
}
