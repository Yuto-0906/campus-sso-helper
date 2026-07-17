# App Storeリリース手順

この手順書は，iPhone・iPadアプリをApp Store Connectへ提出し，審査通過後に手動で公開するまでの標準手順をまとめたものである。Safari機能拡張を含むアプリにも対応する。アプリ固有の値は `<...>` を置き換えて使用する。

## 1. リリース前の確認

- Apple Developer Programが有効であること。
- XcodeのApple Accountに開発者アカウントが追加されていること。
- GitHubでソースコードを管理していること。
- App Storeで使う名称，サブタイトル，説明，キーワード，カテゴリを決めること。
- 第三者の名称，ロゴ，商標を無断で公式名称のように使っていないこと。
- サポートページとプライバシーポリシーを用意すること。
- アプリ内で保存，送信，収集するデータを確認すること。
- アプリ内の表示，プライバシーポリシー，App Storeの申告内容が一致していること。

## 2. バージョンとBundle ID

Xcodeプロジェクトの設定を確認する。

| 項目 | 例 |
| --- | --- |
| App Bundle ID | `com.example.myapp` |
| Extension Bundle ID | `com.example.myapp.Extension` |
| Marketing Version | `1.0.0` |
| Build Number | `1` |
| Team | Apple DeveloperのTeam |

同じApp Storeバージョンへ再アップロードするときは，Build Numberを必ず増やす。新しいバージョンを公開するときはMarketing Versionも増やす。

標準的なバージョン番号は，次のように扱う。

- バグ修正：`1.0.0` → `1.0.1`
- 後方互換のある機能追加：`1.0.0` → `1.1.0`
- 大きな仕様変更：`1.0.0` → `2.0.0`

## 3. 輸出コンプライアンス

独自の暗号化機能を実装せず，OSやHTTPSなどの一般的な暗号化だけを利用するアプリでは，アプリの`Info.plist`へ次を追加する。

```xml
<key>ITSAppUsesNonExemptEncryption</key>
<false/>
```

独自暗号，VPN，暗号資産，暗号化メッセージングなどを実装する場合は，この設定を流用せず，Appleの最新要件を確認する。

## 4. Apple DeveloperでIdentifierを登録

Apple Developerの「Certificates, Identifiers & Profiles」で，必要なExplicit App IDを登録する。

1. アプリ本体のBundle IDを登録する。
2. Safari機能拡張などがある場合は，拡張機能のBundle IDも別に登録する。
3. 使用するCapabilityを有効にする。

Safari Web Extensionの場合は，通常，アプリ本体とExtensionの2個のIdentifierが必要になる。

## 5. サポートページとプライバシーポリシー

他のアプリと同じ構成で，GitHub Pagesを使用する。

```text
docs/
├── index.html       # サポートページ
├── privacy.html     # プライバシーポリシー
├── styles.css       # 共通スタイル
└── .nojekyll
.github/
└── workflows/
    └── pages.yml
```

サポートページには，少なくとも次を記載する。

- アプリの概要
- 導入手順または使い方
- よくある問題と解決方法
- 問い合わせ先
- プライバシーポリシーへのリンク
- 非公式アプリの場合は，公式アプリではないこと

プライバシーポリシーには，少なくとも次を記載する。

- 取得，保存，送信するデータ
- データの利用目的
- 第三者への提供の有無
- 分析，広告，トラッキングの有無
- 保存場所と削除方法
- 問い合わせ先
- 制定日または更新日

GitHub ActionsでPagesを公開する標準ワークフローは次のとおりである。

```yaml
name: Deploy GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: docs
      - id: deployment
        uses: actions/deploy-pages@v4
```

公開後，次の2つをブラウザで開き，内容とリンクを確認する。

```text
https://<GitHubユーザー名>.github.io/<リポジトリ名>/
https://<GitHubユーザー名>.github.io/<リポジトリ名>/privacy.html
```

## 6. App Store Connectでアプリを作成

「マイApp」から新規アプリを作成し，次を設定する。

- プラットフォーム：iOS
- 名前：公開名称
- プライマリ言語：日本語
- Bundle ID：登録済みのアプリ本体Bundle ID
- SKU：他アプリと重複しない管理用文字列
- ユーザアクセス：通常はフルアクセス

作成後に表示されるApple IDは，リリース記録へ残す。

## 7. アーカイブとアップロード

### Xcodeから行う場合

1. 実行先を「Any iOS Device (arm64)」または「Generic iOS Device」にする。
2. `Product` → `Archive`を実行する。
3. Organizerで`Distribute App`を選ぶ。
4. `App Store Connect` → `Upload`を選ぶ。
5. 自動署名で検証し，アップロードする。

### コマンドラインから行う場合

アーカイブを作成する。

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild \
  -project '<App>.xcodeproj' \
  -scheme '<Scheme>' \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath '/private/tmp/<App>.xcarchive' \
  -allowProvisioningUpdates \
  archive
```

`AppStoreAssets/ExportOptions.plist`を作成する。

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>destination</key>
    <string>upload</string>
    <key>method</key>
    <string>app-store-connect</string>
    <key>signingStyle</key>
    <string>automatic</string>
    <key>teamID</key>
    <string>&lt;TEAM_ID&gt;</string>
</dict>
</plist>
```

アップロードする。

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild \
  -exportArchive \
  -archivePath '/private/tmp/<App>.xcarchive' \
  -exportPath '/private/tmp/<App>Export' \
  -exportOptionsPlist 'AppStoreAssets/ExportOptions.plist' \
  -allowProvisioningUpdates
```

`Upload succeeded`と`EXPORT SUCCEEDED`の両方を確認する。アップロード後，App Store Connectで処理が完了するまで数分から数十分待つ。

## 8. スクリーンショット

App Store Connectに表示される最新の必須サイズを優先する。代表的な縦向きサイズは次のとおりである。

- iPhone 6.5インチ：1242×2688または1284×2778
- iPad 12.9インチ：2048×2732

スクリーンショットには，アプリの実際のUIを表示する。ログイン情報，個人情報，通知，デバッグ表示は含めない。

シミュレータを使う場合の例を示す。

```bash
xcrun simctl create '<App> iPhone Screenshots' \
  'com.apple.CoreSimulator.SimDeviceType.iPhone-11-Pro-Max' \
  '<インストール済みiOS Runtime ID>'

xcrun simctl boot '<Device UUID>'
xcrun simctl bootstatus '<Device UUID>' -b
xcrun simctl install '<Device UUID>' '<Appファイルのパス>'
xcrun simctl launch '<Device UUID>' '<Bundle ID>'
xcrun simctl io '<Device UUID>' screenshot '<出力先>.png'
```

画像を開き，文字切れ，黒画面，ローディング表示，解像度違いがないことを確認してから登録する。

## 9. App Storeのメタデータ

バージョン画面で，次を入力する。

- プロモーション用テキスト
- 説明
- キーワード
- サポートURL
- マーケティングURL
- 著作権
- スクリーンショット
- ビルド
- App Review連絡先
- 審査メモ
- バージョンのリリース方法

非公式アプリでは，説明と審査メモに，公式アプリではないことを明記する。外部サービスへログインするアプリでは，審査メモに次を記載する。

- 対象サイトと必要な権限
- 資格情報の保存場所
- 開発者サーバーへ送信しないこと
- MFAやCAPTCHAを回避しないこと
- 審査用アカウントを用意できない理由と，アカウントなしで確認できる範囲

## 10. 一般設定

### アプリ情報

- サブタイトル
- プライマリカテゴリ
- セカンダリカテゴリ
- コンテンツ配信権
- 年齢制限指定

第三者のコンテンツやサービスへアクセスする場合は，コンテンツ配信権の質問へ実態に合わせて回答する。

### アプリのプライバシー

1. 公開済みのプライバシーポリシーURLを入力する。
2. アプリと第三者SDKが収集するデータを確認する。
3. 収集しない場合は「データを収集していない」を選ぶ。
4. 回答を公開する。

端末内だけに保存し，開発者が取得できないデータは，通常，App Store Connect上の「収集」には当たらない。ただし，第三者SDKや外部APIへの送信がある場合は別途確認する。

### 価格および配信状況

- 無料アプリは価格を0に設定する。
- 配信する国または地域を選ぶ。
- 通常公開は「公開」を選ぶ。
- Appleシリコン搭載Macでの提供可否を確認する。
- Apple Vision Proで互換性がない場合は，警告内容を確認する。

配信方法は承認後に変更できない場合があるため，「公開」と「非公開」を慎重に選ぶ。

## 11. ビルドを選択して審査へ提出

1. アップロードしたビルドの処理完了を待つ。
2. バージョン画面の「ビルド」で対象ビルドを選ぶ。
3. 輸出コンプライアンスの追加質問が出た場合は，実装内容に合わせて回答する。
4. 必須項目のエラーがないことを確認する。
5. 「審査へ追加」を押す。
6. App Review画面で提出対象を確認する。
7. 「審査へ提出」を押す。

提出後，状態が「審査待ち」または同等の表示になったことを確認する。

## 12. 審査通過後の公開

標準では「このバージョンを手動でリリース」を選択する。

1. 審査通過通知を確認する。
2. App Store Connectで「このバージョンをリリース」を押す。
3. App Storeの公開ページを開く。
4. 名称，説明，画像，サポートURL，プライバシーURLを確認する。

公開反映には時間がかかることがある。

## 13. 2回目以降のリリース

1. `main`を最新にする。
2. 変更内容を実装し，テストする。
3. Marketing Versionを更新する。
4. Build Numberを前回より大きくする。
5. リリースノートを用意する。
6. アーカイブし，アップロードする。
7. App Store Connectで新しいバージョンを作成する。
8. 新しいビルドを選択する。
9. スクリーンショットや説明を必要に応じて更新する。
10. 審査へ提出する。
11. 審査通過後，手動でリリースする。
12. GitHubへリリース用コミットとタグを残す。

タグの例は次のとおりである。

```bash
git tag -a v1.2.0 -m 'Release 1.2.0'
git push origin v1.2.0
```

## 14. GitHubへ記録するもの

- リリース対象のソースコード
- `docs/`のサポートページとプライバシーポリシー
- Pages用GitHub Actions
- `AppStoreAssets/metadata-ja.md`
- 秘密情報を含まない`ExportOptions.plist`
- 提出に使用したスクリーンショット
- この手順書

証明書の秘密鍵，App Store Connect API秘密鍵，パスワード，個人の資格情報，Provisioning Profileの不要なコピーはコミットしない。

## 15. 提出前の最終チェック

- [ ] App Store上の名称とアプリ内名称が一致している。
- [ ] Bundle IDがApp Store Connectのレコードと一致している。
- [ ] バージョンとBuild Numberが正しい。
- [ ] Release構成でビルドが成功する。
- [ ] 実機またはシミュレータで主要機能を確認した。
- [ ] すべてのスクリーンショットを目視確認した。
- [ ] サポートURLとプライバシーURLが公開されている。
- [ ] プライバシー申告が実装と一致している。
- [ ] 年齢制限指定とコンテンツ配信権へ回答した。
- [ ] 価格，配信地域，公開方法を確認した。
- [ ] App Review連絡先と審査メモを入力した。
- [ ] ビルドをバージョンへ紐付けた。
- [ ] 手動リリースを選択した。
- [ ] 提出対象を確認して審査へ提出した。
- [ ] GitHubへコミットとプッシュを完了した。
