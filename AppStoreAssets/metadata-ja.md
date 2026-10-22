# Campus SSO Helper App Store Metadata（日本語）

## App Information

- App名: Campus SSO Helper
- サブタイトル: ログイン補助と時間割表示
- プライマリカテゴリ: ユーティリティ
- セカンダリカテゴリ: 仕事効率化
- コンテンツ権利: 第三者サービスへアクセスする
- 年齢制限指定: 4+
- Copyright: 2026 Yuto Gemma
- Bundle ID: `jp.yuto.campusssohelper`
- SKU: `campus-sso-helper-ios`

## URLs

- サポートURL: https://yuto-0906.github.io/campus-sso-helper/
- マーケティングURL: https://yuto-0906.github.io/campus-sso-helper/
- プライバシーポリシーURL: https://yuto-0906.github.io/campus-sso-helper/privacy.html

## Promotional Text

Waseda Moodleへのログインを補助し，履修科目の時間割をSafariに表示します。シラバスから曜日・時限・教室も取得します。

## Description

Campus SSO Helperは，Waseda Moodleへのログインを補助し，時間割を表示する非公式のSafari機能拡張です。

主な機能

・対象のログイン画面からMicrosoft SSOへ自動で移動
・保存した大学メールアドレスに一致するアカウントを選択
・メールアドレスとパスワードを自動入力
・サインイン後は学習支援サイトへ自動で戻る
・多要素認証や追加確認が必要な場合は画面を停止
・ログイン後に履修科目とシラバスを取得し，時間割を表示
・学期の切替，曜日・時限の手動修正，科目メモ，予定メモ

プライバシー

パスワードはiOSのKeychainに保存し，端末のロック解除中にMicrosoftのログイン画面への入力だけに使用します。メールアドレスと時間割データはSafari機能拡張の端末内領域に保存します。履修科目の検索には早稲田大学のWebシラバスを利用します。開発者のサーバーへは送信しません。広告，アクセス解析，第三者トラッキングは使用していません。

ご注意

本アプリの利用には，対象の教育機関から発行された有効なアカウントが必要です。Campus SSO Helperは，対象の教育機関，Moodle Pty LtdおよびMicrosoftの公式アプリではなく，これらの組織による承認・後援を示すものではありません。

## Keywords

SSO,Safari,機能拡張,ログイン,大学,学生,時間割,シラバス,学習支援,自動入力,Microsoft

## What's New 2.1.0

- Waseda Moodleのダッシュボードに時間割を追加しました。
- シラバスから曜日・時限・教室を自動取得できるようにしました。
- 科目の手動配置，メモ，色，予定メモ，学期切替に対応しました。
- 前回の時間割と選択中の学期を復元し，最新情報を確認しながら表示できるようにしました。
- ログイン補助の動作を改善し，パスワードの保存先をiOSのKeychainへ変更しました。
- アプリ内にプライバシーポリシーとオープンソースライセンスの表示を追加しました。
- 大学アカウントなしで試せる時間割サンプルを追加し，アプリアイコンを変更しました。

## Review Notes

Campus SSO Helper is an unofficial Safari Web Extension that assists a user-controlled sign-in flow from a specific university learning service to Microsoft SSO.

Important security details:
- The extension requests access to `wsdmoodle.waseda.jp`, `login.microsoftonline.com`, and `www.wsl.waseda.jp/syllabus/*`.
- The syllabus host is used to look up course codes and titles and retrieve timetable details after sign-in.
- Passwords are stored in the iOS Keychain using kSecAttrAccessibleWhenUnlockedThisDeviceOnly. The previous local-storage password is removed only after a successful migration. The email address and timetable preferences remain in local extension storage. Credentials are never sent to the developer.
- The password is inserted only into the Microsoft-hosted password field during a user-initiated login flow.
- MFA, consent, password-change, and other additional-verification screens are never bypassed.
- The app contains no analytics, advertising, or tracking SDKs.
- To review the timetable without an institutional account, open the containing app and tap "時間割のサンプルを試す" (Try the timetable sample). This offline page uses fictional courses and the same timetable renderer and editor as the extension. It supports term switching, course edits, colors, hiding, and schedule notes. Closing the sample discards its edits. It does not contact university or sign-in services.

The live flow requires an active account issued by the supported educational institution. Such credentials cannot be shared with App Review. The containing app explains setup and data handling. Please contact the developer through App Store Connect if additional review material is required.

This app is not affiliated with or endorsed by Waseda University, Moodle Pty Ltd, or Microsoft.

Changes from the released version 2.0.0: timetable display, public syllabus lookups, restored term selection, cached timetable display, and password storage protection. Timetable data is obtained for the signed-in user on their own device, not through a developer backend. Syllabus requests are sequential, paced, and cached. We do not distribute course materials or bypass access controls. The containing app includes the MIT license and attribution for the Better Waseda Moodle reference implementation.

## App Privacy

Developerが収集するデータ: なし

端末上でのみ処理されるデータ:

- 大学メールアドレス
- パスワード
- 自動ログインの設定
- ログイン処理中であることを示す一時的な時刻情報
- Moodleの利用者IDと科目IDに対応する時間割，メモ，シラバスキー

第三者トラッキング: なし

## Export Compliance

- 独自または非免除の暗号化: なし
- HTTPS/TLSおよびOSが提供する標準暗号化のみ
- `ITSAppUsesNonExemptEncryption = NO`
