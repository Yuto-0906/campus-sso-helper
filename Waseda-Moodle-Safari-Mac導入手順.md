# MacからiPadへ導入する手順

## Macへ移すファイル

次の2ファイルをUSBメモリ，AirDrop，iCloud DriveなどでMacへ移す。

1. `waseda-moodle-login-helper-safari-1.1.0.zip`
   - Safari Web Extension本体。
   - ZIPの中には`manifest.json`，JavaScript，設定画面，アイコンが入っている。
2. `MAC_SETUP.md`
   - この手順書。

ソースコード一式やWindows側の`node_modules`は不要である。

## 必要なもの

- macOSを搭載したMac。
- 最新版のXcode。
- iPadと接続用ケーブル，またはXcodeで利用できる無線接続。
- Apple Developer Programへ登録したApple Account。
- ログイン補助に使用するWasedaメールアドレス。

Appleの公式資料では，iOS・iPadOS実機でSafari Web ExtensionをテストするにはApple Developer Programへの登録が必要とされている。

- [Safari Web Extensionを実行する手順](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension)
- [Safari Web Extensionをパッケージ化する手順](https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari)

## 1．Xcodeを準備する

1. Mac App StoreからXcodeをインストールする。
2. Xcodeを一度起動し，追加コンポーネントのインストールを完了する。
3. Xcodeの`Settings`→`Accounts`を開く。
4. Apple Developer Programへ登録したApple Accountを追加する。
5. ターミナルを開き，次を実行する。

```sh
xcode-select -p
```

Xcodeのパスが表示されれば準備完了である。エラーになる場合は次を実行する。

```sh
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
```

## 2．拡張機能ZIPを展開する

Macへ移したZIPが`ダウンロード`フォルダにある場合は，ターミナルで次を実行する。

```sh
mkdir -p ~/Developer/WasedaMoodleAutoLogin/extension
ditto -x -k ~/Downloads/waseda-moodle-login-helper-safari-1.1.0.zip ~/Developer/WasedaMoodleAutoLogin/extension
ls ~/Developer/WasedaMoodleAutoLogin/extension
```

最後のコマンドで`manifest.json`，`core.js`，`microsoft.js`，`moodle.js`などが表示されることを確認する。

ZIPを別の場所へ保存した場合は，`~/Downloads/waseda-moodle-login-helper-safari-1.1.0.zip`を実際のパスへ置き換える。

## 3．Xcodeプロジェクトへ変換する

次を実行する。

```sh
cd ~/Developer/WasedaMoodleAutoLogin
xcrun safari-web-extension-packager --copy-resources ./extension
```

対話形式の質問が表示された場合は，次のように選択する。

- Platform：`iOS`を含める。
- Language：`Swift`。
- App Name：`Waseda Moodle Auto Login`。
- Bundle Identifier：自分だけの一意な値。例は`jp.yuto.wasedamoodleautologin`。

変換後にXcodeプロジェクトが開かない場合は，生成された`.xcodeproj`をFinderから開く。

## 4．署名を設定する

Xcodeのプロジェクト画面で次を設定する。

1. 左側のプロジェクト名を選択する。
2. iOSの包含アプリターゲットを選択する。
3. `Signing & Capabilities`を開く。
4. `Automatically manage signing`を有効にする。
5. `Team`で自分のApple Developerチームを選択する。
6. Safari Web Extensionターゲットでも同じ`Team`を選択する。

Bundle Identifierが既に使われているというエラーが出た場合は，包含アプリと拡張機能の両方を一意な値へ変更する。例は次のとおりである。

- 包含アプリ：`jp.yuto.wasedamoodleautologin`
- 拡張機能：`jp.yuto.wasedamoodleautologin.Extension`

## 5．iPadへインストールする

1. iPadをMacへ接続し，「このコンピュータを信頼」を許可する。
2. Xcode上部のSchemeでiOSの包含アプリを選択する。
3. 実行先として接続したiPadを選択する。
4. `Product`→`Run`を実行する。
5. iPadでDeveloper Modeを求められた場合は，「設定」→「プライバシーとセキュリティ」→「デベロッパモード」を有効にし，iPadを再起動する。
6. 再起動後，Xcodeで再び`Product`→`Run`を実行する。

インストールが成功すると，iPadのホーム画面に`Waseda Moodle Auto Login`の包含アプリが追加される。

## 6．iPadのSafariで拡張機能を有効にする

iPadOSのバージョンによって表示名が少し異なるが，次のどちらかから設定できる。

- 「設定」→「アプリ」→「Safari」→「機能拡張」。
- Safariのページメニュー→「機能拡張を管理」。

`Waseda Moodle Auto Login`を有効にし，Webサイトアクセスを次の2サイトで「許可」にする。

- `wsdmoodle.waseda.jp`
- `login.microsoftonline.com`

「確認」または「拒否」になっていると，ログイン画面を自動操作できない。両方とも「許可」に設定する。

## 7．ログイン補助を設定する

1. Safariで任意のページを開く。
2. Safariのページメニューまたは機能拡張ボタンを開く。
3. `Waseda Moodle Auto Login`を選択する。
4. 「ログイン補助」を有効にする。
5. Wasedaメールアドレスを入力する。
6. 「設定を保存」を押す。
7. 「Waseda Moodleを開く」を押す。

Waseda Moodleが未ログインの場合は，Microsoftのアカウント選択とID入力まで自動で進む。パスワードは拡張機能へ保存せず，SafariまたはiCloudキーチェーンの自動入力を利用する。パスワード入力，多要素認証，利用規約への同意などは利用者が完了する。

## 8．動作確認

Safariで次のURLを開く。

```text
https://wsdmoodle.waseda.jp/my/
```

確認項目は次のとおりである。

- Moodleの通常ログイン画面で止まらず，Microsoft SSOへ移動する。
- 保存済みアカウントがある場合は自動で選択される。
- メールアドレス画面が自動で進み，パスワード画面ではSafariの自動入力を利用できる。
- 最終的にWaseda Moodleのマイページが表示される。

## トラブル対応

### 拡張機能が表示されない

- Xcodeで包含アプリをiPadへインストール済みか確認する。
- iPadのSafari設定で拡張機能を有効にする。
- Xcodeで包含アプリと拡張機能の両ターゲットに同じTeamを設定する。

### Waseda Moodleのログイン画面で止まる

- `wsdmoodle.waseda.jp`へのアクセスを「許可」にする。
- 拡張機能の設定で「ログイン補助」が有効か確認する。
- メールアドレスを保存し直す。

### Microsoft画面で止まる

- `login.microsoftonline.com`へのアクセスを「許可」にする。
- パスワードは拡張機能へ保存されない。必要に応じてSafariまたはiCloudキーチェーン側の保存内容を更新する。
- パスワード入力，多要素認証，利用規約への同意，パスワード変更要求は手動で完了する。

### 署名エラーが出る

- Xcodeの`Settings`→`Accounts`でApple Accountへ再ログインする。
- Bundle Identifierを別の一意な値へ変更する。
- `Automatically manage signing`とTeamの設定を両ターゲットで確認する。

## セキュリティ上の注意

Safari拡張機能のローカルストレージへ保存するのは，Wasedaメールアドレス，ログイン補助の有効・無効，処理中の一時的な時刻情報だけである。パスワードは保存，読取，自動入力を行わない。旧バージョンで保存されたパスワードは，バージョン1.1.0以降の起動時に削除される。保存データは開発者や第三者のサーバーへ送信しない。

保存データを削除するときは，拡張機能の設定画面で「保存データを削除」を押す。
