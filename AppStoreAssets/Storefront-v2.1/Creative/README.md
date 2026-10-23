# ヘッダ・検索結果用クリエイティブアセット

- `WasePlus-header.png`：3840 × 1646。プロダクトページのヘッダ用。
- `WasePlus-search.png`：3840 × 2560。検索結果用。
- `*-overview.png`：確認用縮小画像。アップロード対象外。
- いずれも透過なしのPNG。動画は追加しない。

既存アイコン・配色を使い，主要な情報を中央へ配置している。検索結果画像の時間割は，既に撮影したiPad版の架空サンプル画面から学期タブと時間割を切り抜いたもの。科目やボタンを描き足す加工はしていない。大学のロゴ，実際の履修情報，ログイン情報は含まない。

`sharp`が使えるNode環境で，`scripts/compose_creative_assets.cjs`から再作成できる。画像サイズ，不透明性，SHA-256は`creative-report.json`に記録する。アプリ本体の変更や新しいビルドは不要。

参照：[Appleのクリエイティブアセット仕様](https://developer.apple.com/help/app-store-connect/reference/app-information/creative-assets-specifications)，[アセットのベストプラクティス](https://developer.apple.com/app-store/asset-best-practices/)，[アップロード手順](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-your-app-store-assets)。

App Store Connectでは2.1.0の日本語版に割り当てる。最終の審査提出は実行しない。
