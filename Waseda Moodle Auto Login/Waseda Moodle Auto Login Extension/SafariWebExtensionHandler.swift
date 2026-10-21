import Foundation
import SafariServices

final class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    private let syllabusOrigin = URL(string: "https://www.wsl.waseda.jp")!
    private let allowedPaths: Set<String> = [
        "/syllabus/index.php", "/syllabus/JAA102.php", "/syllabus/JAA104.php"
    ]

    func beginRequest(with context: NSExtensionContext) {
        let item = context.inputItems.first as? NSExtensionItem
        guard let message = item?.userInfo?[SFExtensionMessageKey] as? [String: Any] else {
            complete(context, ["ok": false, "error": "要求が正しくありません。"])
            return
        }
        if message["type"] as? String == "campus-sso:credentials-native" {
            handleCredentials(message, context: context)
            return
        }
        guard message["type"] as? String == "campus-sso:syllabus-native",
              let path = message["path"] as? String,
              let url = URL(string: path, relativeTo: syllabusOrigin)?.absoluteURL,
              url.scheme == "https",
              url.host == syllabusOrigin.host,
              allowedPaths.contains(url.path) else {
            complete(context, ["ok": false, "error": "許可されていないシラバスURLです。"])
            return
        }

        var request = URLRequest(url: url)
        request.timeoutInterval = 25
        if let rawFields = message["fields"], !(rawFields is NSNull) {
            guard url.path == "/syllabus/index.php",
                  let fields = rawFields as? [[String]],
                  fields.count <= 50,
                  fields.allSatisfy({ pair in
                      pair.count == 2 &&
                      pair[0].range(of: "^[A-Za-z0-9_]{1,40}$", options: .regularExpression) != nil &&
                      pair[1].utf8.count <= 512
                  }) else {
                complete(context, ["ok": false, "error": "検索条件が正しくありません。"])
                return
            }
            let boundary = "CampusSSO-\(UUID().uuidString)"
            var body = Data()
            for pair in fields {
                body.append(Data("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(pair[0])\"\r\n\r\n\(pair[1])\r\n".utf8))
            }
            body.append(Data("--\(boundary)--\r\n".utf8))
            request.httpMethod = "POST"
            request.httpBody = body
            request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        }

        let task = URLSession.shared.dataTask(with: request) { [self] data, response, error in
            if let error = error {
                complete(context, ["ok": false, "error": error.localizedDescription])
                return
            }
            guard let http = response as? HTTPURLResponse else {
                complete(context, ["ok": false, "error": "シラバスから応答がありません。"])
                return
            }
            guard (200...299).contains(http.statusCode) else {
                complete(context, ["ok": false, "error": "HTTP \(http.statusCode)"])
                return
            }
            guard let data = data, data.count <= 8_000_000,
                  let html = String(data: data, encoding: .utf8) else {
                complete(context, ["ok": false, "error": "シラバスの本文を読み取れませんでした。"])
                return
            }
            complete(context, ["ok": true, "html": html])
        }
        task.resume()
    }

    private func handleCredentials(_ message: [String: Any], context: NSExtensionContext) {
        let store = CredentialStore()
        do {
            switch message["action"] as? String {
            case "status":
                complete(context, ["ok": true, "hasPassword": try store.load() != nil])
            case "get":
                complete(context, ["ok": true, "password": try store.load() ?? ""])
            case "set", "migrate":
                guard let password = message["password"] as? String else {
                    complete(context, ["ok": false, "error": "パスワードが正しくありません。"])
                    return
                }
                try store.save(password, overwrite: message["action"] as? String != "migrate")
                complete(context, ["ok": true, "hasPassword": true])
            case "remove":
                try store.remove()
                complete(context, ["ok": true, "hasPassword": false])
            default:
                complete(context, ["ok": false, "error": "許可されていない資格情報の操作です。"])
            }
        } catch {
            // Do not expose Keychain contents or request fields in diagnostics.
            complete(context, ["ok": false, "error": "Keychainを利用できません。端末のロックを解除して再度お試しください。"])
        }
    }

    private func complete(_ context: NSExtensionContext, _ result: [String: Any]) {
        let response = NSExtensionItem()
        response.userInfo = [SFExtensionMessageKey: result]
        context.completeRequest(returningItems: [response], completionHandler: nil)
    }
}
