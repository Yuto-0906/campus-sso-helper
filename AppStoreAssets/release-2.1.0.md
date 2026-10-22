# 2.1.0のApp Store更新準備

## 対象

- アプリ：WasePlus｜Safari拡張（副題：時間割とログイン）
- App Store Connect ID：6791983170
- バージョン：2.1.0，ビルド：12
- アプリBundle ID：`jp.yuto.campusssohelper`
- 拡張Bundle ID：`jp.yuto.campusssohelper.Extension`
- 配布バイナリのソース：`283fc201346979a8d9c1100a2294dcc28980f856`
- [更新情報](https://appstoreconnect.apple.com/apps/6791983170/distribution/ios/version/inflight)

## 署名とアップロード

[GitHub Actions](https://github.com/Yuto-0906/campus-sso-helper/actions/runs/39724150271)でRelease構成をアーカイブし，App Store Connect用に書き出した。アプリ本体とSafari拡張の署名，Bundle ID，entitlements，埋め込みプロファイル，プライバシーポリシーとMITライセンスの同梱を検証した。

- IPA：`CampusSSOHelper-2.1.0-build12.ipa`
- SHA-256：`fa83e24ccc2bf09b8f6c6cb806b459a940d087ba22509c6fd698eaa5cf2928d1`
- Apple側のビルドID：`5bc38482-af81-42dd-b433-c1a538de1cf4`
- Apple側の処理状態：`VALID`
- 配布用証明書と両プロファイルの期限：2027年10月21日02:19:58 UTC
- CI成果物の保存期間：7日

署名情報は承認を受けたこのリポジトリのActions Secretsに登録している。値やプロファイルはソース管理へ含めない。macOSジョブでは一時Keychainを使い，終了時に署名情報を削除する。

## 再作成

1. 変更内容に応じてバージョンを更新し，ビルド番号を12より大きくする。
2. `scripts/prepare_release_resources.py`で元ソースと同梱リソースを同期する。
3. アイコンを変更した場合は`sharp`を利用できるNode環境で`scripts/render_icons.cjs`を実行する。
4. `node --test`を実行し，ソースをコミットする。
5. `ios-app-store.yml`のworkflow_dispatchを対象コミットで実行する。アップロードまでを行い，審査への提出は行わない。
6. Apple側のビルド処理が完了してから，バージョン画面へビルドを紐付ける。

## 掲載・審査用素材

- 日本語の説明，更新内容，審査メモ：`metadata-ja.md`。ストア説明，案内画面，ライセンス画面にBetter Waseda Moodleの作者と参考実装を明記。
- 新アイコン：大学の文字・ロゴを使わないカレンダーとログイン矢印。
- 時間割サンプル：大学アカウント不要。架空の科目を使い，通信と永続保存を行わない。同じ時間割レンダラーと編集機能を使用する。
- シミュレータ画像：`Screenshots-v2.1/`。iPhone 17 Pro MaxとiPad Pro 13-inch（M5），iOS 26.5で，包含アプリの設定ガイドと時間割サンプルを撮影し，4枚を目視確認した。不透明であることを確認してから，表示内容を変えずにPNGのアルファチャンネルを除去した。
- ローカルの実際のブラウザーで，サンプルの学期切替，教室・科目メモの編集，予定メモの追加，リロードによる編集の破棄を確認した。
- 新しい掲載画像と紹介動画の試作：`Storefront-v2.1/`。動画はユーザー判断用で，App Store Connectへアップロードしない。
- [撮影専用ジョブ](https://github.com/Yuto-0906/campus-sso-helper/actions/runs/39789978190)で，iPhone・iPadそれぞれ7状態の撮影と録画が成功した。完成した掲載画像は各5枚。動画は各29秒で，起動前後のホーム画面を除外し，字幕と実画面を確認した。
- 撮影操作用のフックはDEBUG構成のみ。ビルド12の両Releaseバイナリに撮影用の環境変数名が存在しないことを確認。
- サポートサイトは`main`からだけデプロイできる。保護設定を維持し，統合後のPagesワークフローで公開する。

公開中の2.0.0もパスワード入力を補助していた。今回の更新では保存先をKeychainへ移し，旧保存先からの移行失敗時にも既存データを失わないようにした。JavaScriptテスト25件，実際のmacOS Keychain操作，iOSビルドを検証した。時間割の既存機能はiPhone・iPadで実機確認済みだが，2.1.0のKeychain変更を両実機で確認したという記録ではない。

審査への提出とApp Storeでの公開は，この準備作業の対象に含めない。
