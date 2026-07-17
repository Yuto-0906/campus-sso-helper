# Waseda Moodle Login Helper

Waseda MoodleからMicrosoft SSOへのログイン操作を補助するSafari Web Extensionである。早稲田大学およびMicrosoftの公式アプリではない。

## 安全性

- パスワードの保存，読取，自動入力を行わない。
- 保存するのは，Wasedaメールアドレス，ログイン補助の有効・無効，処理中の一時的な時刻情報だけである。
- 保存データを開発者のサーバーへ送信しない。
- パスワード入力にはSafariまたはiCloudキーチェーンを利用する。
- アクセス対象は`wsdmoodle.waseda.jp`と`login.microsoftonline.com`だけである。

## 動作

1. Waseda Moodleのログイン画面からMicrosoft SSOへ移動する。
2. 保存したメールアドレスに一致するアカウントを選択するか，メールアドレスを入力する。
3. パスワード画面で停止し，利用者がSafariまたはiCloudキーチェーンを使って認証する。
4. 多要素認証などが必要な場合は利用者が完了する。

## 構成

- `extension/`：Safari Web Extensionの元ソース。
- `Waseda Moodle Auto Login/`：iOS・iPadOS用の包含アプリとXcodeプロジェクト。
- `Waseda-Moodle-Safari-Mac導入手順.md`：MacからiPadへ導入する手順。
- `PRIVACY.md`：プライバシーポリシー。

## バージョン

現在のバージョンは`1.1.0`である。
