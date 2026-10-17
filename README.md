# Campus SSO Helper

Waseda MoodleからMicrosoft SSOへのログインを補助し，Moodleのダッシュボードに時間割を表示するSafari Web Extensionである。早稲田大学およびMicrosoftの公式アプリではない。

## 資格情報の取扱い

- WasedaメールアドレスとパスワードをSafari機能拡張のローカルストレージに保存する。
- 保存した資格情報はMicrosoftのログイン画面への自動入力だけに使用する。
- 保存データを開発者のサーバーへ送信しない。
- 時間割データはSafari機能拡張のローカルストレージに保存する。
- アクセス対象は`wsdmoodle.waseda.jp`，`login.microsoftonline.com`，シラバスを取得する`www.wsl.waseda.jp`である。
- 端末を第三者と共用する場合は使用せず，利用後に設定画面の「資格情報を削除」を実行する。

## 動作

1. Waseda Moodleのログイン画面からMicrosoft SSOへ移動する。
2. 保存したメールアドレスに一致するアカウントを選択するか，メールアドレスを入力する。
3. Microsoftのパスワード画面へ保存したパスワードを入力し，サインインする。
4. 多要素認証などが必要な場合は利用者が完了する。
5. ログイン後にSafariでMoodleのダッシュボードを開くと，履修科目とシラバスを取得して時間割を表示する。

## 時間割

- Moodleの履修科目APIから科目を取得し，早稲田大学のWebシラバスから年度，学期，曜日，時限，教室を補完する。取得できなかった科目は手動で配置できる。
- 学期切替，科目からMoodle・シラバスへの移動，科目メモ，色，予定メモ，非表示に対応する。
- 時間割はiPhone・iPadのSafari内に表示される。Chrome拡張機能に保存された時間割設定はSafariへ自動転送されない。
- 元の拡張機能の仕様とMITライセンスは[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)を参照。

## 構成

- `extension/`：Safari Web Extensionの元ソース。
- `Waseda Moodle Auto Login/`：iOS・iPadOS用の包含アプリとXcodeプロジェクト。
- `Waseda-Moodle-Safari-Mac導入手順.md`：MacからiPadへ導入する手順。
- `PRIVACY.md`：プライバシーポリシー。

## バージョン

現在のバージョンは`1.3.2`である。
