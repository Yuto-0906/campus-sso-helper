# WasePlusの掲載素材

- App Store名：**WasePlus｜Safari拡張**
- 副題：**時間割とログイン**
- アイコン：既存のカレンダーとログイン矢印を継続。

## 掲載画像

iPhone用5枚（1320 × 2868），iPad用5枚（2064 × 2752）を用意する。

1. **Moodleに，見やすい時間割を。** シラバスからの曜日・時限・教室の取得を伝える。
2. **教室も，メモも。自分の時間割に。** 実際の科目編集画面を見せる。
3. **開き直しても，前回の学期から。** 学期の復元と保存済み科目の表示を伝える。
4. **毎回のログインを，もっとスムーズに。** Safari拡張の設定とKeychainでの保存を説明する。
5. **空きコマに，自分の予定も。** 実際に追加した予定を時間割内に見せる。

元画面は包含アプリのオフラインサンプルをシミュレータで操作して撮影する。架空の科目を使い，大学アカウントや実際の履修情報は含めない。画面は縦横比を維持して縮小し，枠と見出しを合成する。科目やボタンを描き足して機能を装う加工はしない。

[撮影ジョブ](https://github.com/Yuto-0906/campus-sso-helper/actions/runs/39789978190)は成功した。iPhone 17 Pro MaxとiPad Pro 13-inch（M5），iOS 26.5で，各画面を止めて撮影している。両端末の7状態がそれぞれ異なる画像であることを検証し，全10枚のレイアウトと実画面を目視した。完成画像の寸法とアルファチャンネルがないことも確認した。

## 紹介動画

`Preview/`の動画は**ユーザー判断用の試作**。承認前にApp Store Connectへアップロードしない。実際のサンプル画面の操作録画に日本語の見出しを加える。外部の音楽，大学のログイン情報，個人の時間割は含めない。

両動画は29秒，H.264 High Profile Level 4.0，30 fps，yuv420pである。iPhone版は886 × 1920，iPad版は1200 × 1600。起動前後のホーム画面を除外し，操作の場面と字幕を照合した。開始位置は`Sources/preview-timing.json`に記録した。

## 再作成

1. 撮影ワークフローの成果物を取得し，PNGと撮影レポートを`Sources/`へ保存する。録画の原本はローカルの`build/`に保管する。
2. `sharp`が使えるNode環境で`scripts/compose_storefront.cjs`を実行する。
3. `FFMPEG`環境変数にFFmpegの実行ファイルを指定し，`scripts/compose_preview.cjs <撮影成果物のディレクトリ>`を実行する。
4. 全画像と動画の各場面を目視し，日本語の文字，実画面の状態，余白，字幕の時刻，画像サイズ，不透明性を確認する。

仕様の参照先：[Appleのプロダクトページ案内](https://developer.apple.com/app-store/product-page/)，[アプリプレビュー](https://developer.apple.com/app-store/app-previews/)，[動画の仕様](https://developer.apple.com/help/app-store-connect/reference/app-information/app-preview-specifications/)。
