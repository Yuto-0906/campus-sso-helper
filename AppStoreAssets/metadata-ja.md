# Campus SSO Helper App Store Metadata（日本語）

## App Information

- App名: Campus SSO Helper
- サブタイトル: 大学SSOログインを自動化
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

大学の学習支援サイトからMicrosoft SSOへのログイン操作を短縮。Safariで毎回繰り返すアカウント選択と資格情報入力を補助します。

## Description

Campus SSO Helperは，対象の大学学習支援サイトからMicrosoft SSOへのログイン操作を補助する，非公式のSafari機能拡張です。

主な機能

・対象のログイン画面からMicrosoft SSOへ自動で移動
・保存した大学メールアドレスに一致するアカウントを選択
・メールアドレスとパスワードを自動入力
・サインイン後は学習支援サイトへ自動で戻る
・多要素認証や追加確認が必要な場合は画面を停止

プライバシー

資格情報はSafari機能拡張のローカル領域に保存され，Microsoftのログイン画面への入力にだけ使用されます。開発者のサーバーへ送信されません。広告，アクセス解析，第三者トラッキングは使用していません。

ご注意

本アプリの利用には，対象の教育機関から発行された有効なアカウントが必要です。Campus SSO Helperは，対象の教育機関，Moodle Pty LtdおよびMicrosoftの公式アプリではなく，これらの組織による承認・後援を示すものではありません。

## Keywords

SSO,Safari,機能拡張,ログイン,大学,学生,学習支援,自動入力,Microsoft

## What's New 1.2.2

- 初回設定ガイドを見やすく刷新しました。
- 実際の設定画面と資格情報入力画面を使った説明を追加しました。
- アプリからSafari機能拡張の設定を開けるボタンを追加しました。
- Safari機能拡張の設定画面を中央配置の見やすいデザインへ改善しました。
- 白黒・アイボリー・サンド・ココアを基調とした，落ち着きと温かみのあるデザインへ刷新しました。

## Review Notes

Campus SSO Helper is an unofficial Safari Web Extension that assists a user-controlled sign-in flow from a specific university learning service to Microsoft SSO.

Important security details:
- The extension only requests access to `wsdmoodle.waseda.jp` and `login.microsoftonline.com`.
- Credentials are saved locally in Safari extension storage and are never sent to the developer.
- The password is inserted only into the Microsoft-hosted password field during a user-initiated login flow.
- MFA, consent, password-change, and other additional-verification screens are never bypassed.
- The app contains no analytics, advertising, or tracking SDKs.

The live flow requires an active account issued by the supported educational institution. Such credentials cannot be shared with App Review. The containing app explains setup and data handling. Please contact the developer through App Store Connect if additional review material is required.

This app is not affiliated with or endorsed by Waseda University, Moodle Pty Ltd, or Microsoft.

## App Privacy

Developerが収集するデータ: なし

端末上でのみ処理されるデータ:

- 大学メールアドレス
- パスワード
- 自動ログインの設定
- ログイン処理中であることを示す一時的な時刻情報

第三者トラッキング: なし

## Export Compliance

- 独自または非免除の暗号化: なし
- HTTPS/TLSおよびOSが提供する標準暗号化のみ
- `ITSAppUsesNonExemptEncryption = NO`
