# Waseda Moodle Login Helper

Waseda MoodleからMicrosoft SSOへのログイン操作を補助するSafari Web Extensionである。早稲田大学およびMicrosoftの公式アプリではない。

## 資格情報の取扱い

- WasedaメールアドレスとパスワードをSafari機能拡張のローカルストレージに保存する。
- 保存した資格情報はMicrosoftのログイン画面への自動入力だけに使用する。
- 保存データを開発者のサーバーへ送信しない。
- アクセス対象は`wsdmoodle.waseda.jp`と`login.microsoftonline.com`だけである。
- 端末を第三者と共用する場合は使用せず，利用後に設定画面の「資格情報を削除」を実行する。

## 動作

1. Waseda Moodleのログイン画面からMicrosoft SSOへ移動する。
2. 保存したメールアドレスに一致するアカウントを選択するか，メールアドレスを入力する。
3. Microsoftのパスワード画面へ保存したパスワードを入力し，サインインする。
4. 多要素認証などが必要な場合は利用者が完了する。

## 構成

- `extension/`：Safari Web Extensionの元ソース。
- `Waseda Moodle Auto Login/`：iOS・iPadOS用の包含アプリとXcodeプロジェクト。
- `Waseda-Moodle-Safari-Mac導入手順.md`：MacからiPadへ導入する手順。
- `PRIVACY.md`：プライバシーポリシー。

## バージョン

現在のバージョンは`1.2.0`である。
