# App Store Screenshots v2

白黒・アイボリー・サンド・ココアを基調に，実際のアプリ画面と生成背景を組み合わせたApp Store用画像である。

## 提出順

1. `01-smooth-login.jpg`：大学SSOを，もっとスムーズに。
2. `02-easy-setup.jpg`：設定まで，迷わない。
3. `03-local-privacy.jpg`：資格情報は，端末内だけ。
4. `04-four-steps.jpg`：4ステップで，すぐ使える。

## サイズ

- `iphone-6.9/`：1320×2868 px
- `ipad-13/`：2064×2752 px

すべて高品質JPEGで出力し，アルファチャンネルを含めない。

## 再生成

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
CLANG_MODULE_CACHE_PATH=/private/tmp/CampusSSOScreenshotClangCache \
SWIFT_MODULECACHE_PATH=/private/tmp/CampusSSOScreenshotSwiftCache \
xcrun swift AppStoreAssets/Screenshots-v2/ScreenshotComposer.swift
```

## 構成

- `Backgrounds/`：画像生成した抽象背景
- `Sources/`：個人情報や資格情報を含まない実UI素材
- `ScreenshotComposer.swift`：正確な日本語見出し，端末フレーム，UI素材を合成するスクリプト

画像生成では背景だけを作成し，文字，ロゴ，端末，UIは生成していない。日本語コピーと実際のアプリ画面はローカルで決定的に合成している。

## 画像生成プロンプト

すべてbuilt-in image generationの`ads-marketing`用途として生成した。

1. 温かいアイボリーからサンドの背景に，ココア色の柔らかなリボン状曲線。静かで上質なエディトリアル調。縦長，中央に十分な余白。
2. 深いココアの背景に，サンド色の光の軌跡と繊細な粒子。高速さと簡潔さを感じるモダンな抽象表現。縦長，上部は文字用の余白。
3. アイボリー，サンド，淡いココアの半透明レイヤーが保護膜のように重なる抽象背景。安心感とプライバシーを表現。縦長，中央は静かな余白。
4. アイボリーの紙質背景に，サンドとココアの細い曲線と4つの抽象的な節点。手順が自然につながる印象。縦長，読みやすい余白。

共通制約は，文字，ロゴ，端末，UI，人物，ブランド，透かしを生成しないことである。
