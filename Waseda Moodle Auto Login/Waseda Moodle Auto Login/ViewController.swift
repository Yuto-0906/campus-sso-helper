//
//  ViewController.swift
//  Waseda Moodle Auto Login
//
//  Created by 源間悠翔 on 2026/07/17.
//

import UIKit
import SafariServices
import WebKit

class ViewController: UIViewController, WKNavigationDelegate, WKScriptMessageHandler {

    @IBOutlet var webView: WKWebView!

    private let extensionBundleIdentifier = "jp.yuto.campusssohelper.Extension"

    override func viewDidLoad() {
        super.viewDidLoad()

        self.webView.navigationDelegate = self
        self.webView.scrollView.isScrollEnabled = true

        self.webView.configuration.userContentController.add(self, name: "controller")

        self.webView.loadFileURL(Bundle.main.url(forResource: "Main", withExtension: "html")!, allowingReadAccessTo: Bundle.main.resourceURL!)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        let supportsDirectSettings: Bool
        if #available(iOS 26.2, *) {
            supportsDirectSettings = true
        } else {
            supportsDirectSettings = false
        }

        let script = "document.documentElement.dataset.directSettings = '\(supportsDirectSettings ? "true" : "false")';"
        webView.evaluateJavaScript(script)
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url,
              url.scheme == "campus-sso-helper" else {
            decisionHandler(.allow)
            return
        }

        decisionHandler(.cancel)

        switch url.host {
        case "extension-settings":
            openExtensionSettings()
        case "app-settings":
            openAppSettings()
        default:
            updateStatus("この操作を開けませんでした。", isError: true)
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        // Override point for customization.
    }

    private func openExtensionSettings() {
        if #available(iOS 26.2, *) {
            SFSafariSettings.openExtensionsSettings(
                forIdentifiers: [extensionBundleIdentifier]
            ) { [weak self] error in
                guard let error else { return }
                DispatchQueue.main.async {
                    self?.updateStatus("Safari機能拡張の設定を開けなかったため，アプリ設定を開きます。", isError: true)
                    self?.openAppSettings()
                }
            }
        } else {
            updateStatus("このiOSではアプリ設定が開きます。画面の手順に沿ってSafariの機能拡張へ進んでください。")
            openAppSettings()
        }
    }

    private func openAppSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else {
            updateStatus("設定画面を開けませんでした。", isError: true)
            return
        }

        UIApplication.shared.open(url, options: [:]) { [weak self] success in
            if !success {
                self?.updateStatus("設定画面を開けませんでした。", isError: true)
            }
        }
    }

    private func updateStatus(_ message: String, isError: Bool = false) {
        guard let data = try? JSONSerialization.data(withJSONObject: [message]),
              let encodedMessages = String(data: data, encoding: .utf8) else {
            return
        }

        let script = """
        (() => {
            const element = document.getElementById('action-status');
            if (!element) return;
            element.textContent = \(encodedMessages)[0];
            element.classList.toggle('error', \(isError));
        })();
        """
        webView.evaluateJavaScript(script)
    }

}
