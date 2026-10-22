# 2.1.0のApp Store更新準備

## 対象

- アプリ：Campus SSO Helper
- App Store Connect ID：6791983170
- バージョン：2.1.0，ビルド：11
- アプリBundle ID：`jp.yuto.campusssohelper`
- 拡張Bundle ID：`jp.yuto.campusssohelper.Extension`
- 配布バイナリのソース：`4de9083c91651850ef95f36b6447bfed0024d9d7`
- [更新情報](https://appstoreconnect.apple.com/apps/6791983170/distribution/ios/version/inflight)

## 署名とアップロード

[GitHub Actions](https://github.com/Yuto-0906/campus-sso-helper/actions/runs/39720522577)でRelease構成をアーカイブし，App Store Connect用に書き出した。アプリ本体とSafari拡張の署名，Bundle ID，entitlements，埋め込みプロファイル，プライバシーポリシーとMITライセンスの同梱を検証した。

- IPA：`CampusSSOHelper-2.1.0-build11.ipa`
- SHA-256：`f2219f7035d8daaf625965f616a4ae0278e4b9469bd3518cd8895ecda2f6d101`
- Apple側のビルドID：`89df8dcb-af37-45bc-b944-5be8f8daa2c0`
- Apple側の処理状態：`VALID`
- 配布用証明書と両プロファイルの期限：2027年10月21日02:19:58 UTC
- CI成果物の保存期間：7日

署名情報は承認を受けたこのリポジトリのActions Secretsに登録している。値やプロファイルはソース管理へ含めない。macOSジョブでは一時Keychainを使い，終了時に署名情報を削除する。

## 再作成

1. 変更内容に応じてバージョンを更新し，ビルド番号を11より大きくする。
2. `scripts/prepare_release_resources.py`で元ソースと同梱リソースを同期する。
3. アイコンを変更した場合は`sharp`を利用できるNode環境で`scripts/render_icons.cjs`を実行する。
4. `node --test`を実行し，ソースをコミットする。
5. `ios-app-store.yml`のworkflow_dispatchを対象コミットで実行する。アップロードまでを行い，審査への提出は行わない。
6. Apple側のビルド処理が完了してから，バージョン画面へビルドを紐付ける。

## 掲載・審査用素材

- 日本語の説明，更新内容，審査メモ：`metadata-ja.md`
- 新アイコン：大学の文字・ロゴを使わないカレンダーとログイン矢印。
- 時間割サンプル：大学アカウント不要。架空の科目を使い，通信と永続保存を行わない。同じ時間割レンダラーと編集機能を使用する。
- シミュレータ画像：`Screenshots-v2.1/`。iPhone 17 Pro MaxとiPad Pro 13-inch（M5），iOS 26.5で，包含アプリの設定ガイドと時間割サンプルを撮影し，4枚を目視確認した。不透明であることを確認してから，表示内容を変えずにPNGのアルファチャンネルを除去した。
- ローカルの実際のブラウザーで，サンプルの学期切替，教室・科目メモの編集，予定メモの追加，リロードによる編集の破棄を確認した。
- サポートサイトは`main`からだけデプロイできる。保護設定を維持し，統合後のPagesワークフローで公開する。

公開中の2.0.0もパスワード入力を補助していた。今回の更新では保存先をKeychainへ移し，旧保存先からの移行失敗時にも既存データを失わないようにした。JavaScriptテスト25件，実際のmacOS Keychain操作，iOSビルドを検証した。時間割の既存機能はiPhone・iPadで実機確認済みだが，2.1.0のKeychain変更を両実機で確認したという記録ではない。

審査への提出とApp Storeでの公開は，この準備作業の対象に含めない。
