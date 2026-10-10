# 畑しごと

個人農家向けの圃場・栽培計画・農作業管理アプリ。iPhoneとPCで同じ農場データを扱います。

## 実装済み

- 地区と普段の呼び名による圃場管理、検索、利用停止。
- 圃場別年間表、年をまたぐ栽培、同一作物の複数作、複数圃場への一括登録、工程を再利用する計画コピー。
- 作物別の作業ひな形、繰り返し耕起、任意の堆肥散布、作業追加、完了、延期、中止、実施日訂正。
- 田植え時の除草剤同時散布の有無と、後日の散布対象の管理。
- 牧草類の収穫後にロール運搬を追加。収穫実施日＋14日を目安に設定。
- 甘藷の圃場使用管理。終了予定を過ぎても使用終了確認まで空き扱いにしない。
- 現在の空きと指定日の空き見込みの区別。
- Googleログイン、Firestoreリアルタイム共有、競合検出付きトランザクション保存。
- iPhone向けホーム画面アプリ、Web Push、Gmail宛ての毎朝の作業メール。
- 手動JSONエクスポート、毎日の自動バックアップ、30日保持、最新バックアップの取得。

クラウド未設定時は明示的なデモのみ利用可能です。デモはメモリ内で動作し、データは保存・通知されません。

## ローカル実行

Node.js 24以降を使用します。

```powershell
npm ci
npm run dev
npm test
npm run build
```

`http://127.0.0.1:5173` を開きます。ブラウザ検証はChromeがある環境で、開発サーバー起動中に `node tests/browser.smoke.mjs` を実行します。

## GitHubへの公開

本プロジェクトだけをリポジトリにしてください。ホームフォルダー全体を公開しないでください。

```powershell
git init -b main
git add .
git commit -m "Build farm planning and work management app"
gh auth login
gh repo create farm-planner --public --source . --remote origin --push
```

公開対象はソースコードです。圃場データ、認証情報、`.env.local`、サービスアカウント鍵は公開しません。ソース内の圃場名は匿名のサンプルです。

## Firebaseの初期設定

1. Firebaseプロジェクトを作成し、Webアプリを登録します。
2. AuthenticationでGoogleプロバイダーを有効にします。
3. Cloud Firestoreを本番モードで作成します。東京リージョンなど利用地域に合わせます。
4. `.env.example` を `.env.local` にコピーし、Webアプリの4項目を設定します。
5. `firestore.rules` の `REPLACE_WITH_OWNER_EMAIL` を本人のGoogleメールアドレスへ置き換え、ルールを公開します。初期ファイルはアクセスを拒否します。
6. Vercelの本番ドメインをAuthenticationの承認済みドメインへ追加します。
7. Admin SDKのサービスアカウントのproject ID、client email、private keyをVercelのサーバー環境変数へ登録します。鍵はGitに含めません。

ブラウザの認証はWeb設定、通知・バックアップはAdmin設定を使います。Firestoreルールとサーバーの `OWNER_EMAIL` の両方を同じ本人アドレスにします。他のGoogleアカウントは農場データへアクセスできません。

## Vercelでの運用

1. VercelでGitHubの `farm-planner` をインポートします。
2. Framework PresetはVite、Build Commandは `npm run build`、Output Directoryは `dist`。
3. `.env.example` に記載した環境変数をVercelへ設定します。
4. 本番デプロイ後、Firebaseの承認済みドメインを更新します。
5. 本人のGoogleログインで、圃場登録・PCとiPhone間の同期を確認します。
6. iPhoneでSafariの共有メニューからホーム画面へ追加し、追加したアプリの「設定」で通知を有効にします。

`vercel.json` のCronはUTC 21時＝日本時間翌朝6時です。Vercelのプランによって定期実行の正確さ・利用条件が異なります。農業の業務利用では商用利用条件を確認して適切なプランを選びます。

通知用の鍵は、ローカルで `npm run keys` を実行して新規生成し、Vercel環境変数へ登録してください。表示された秘密鍵はチャットやGitに貼らないでください。`VITE_`付きはブラウザ公開値、付かない秘密鍵・Cron secret・メールパスワードはサーバー専用です。

メールはGmail SMTPを使用します。`GMAIL_USER` とGoogleアカウントのアプリパスワード `GMAIL_APP_PASSWORD` を設定します。アプリパスワードにはGoogleの2段階認証などの条件があります。通常のログインパスワードは使いません。

画面のメール通知と端末通知は別々に有効・無効にできます。メール送信先は認証した本人のGoogleメールアドレスです。

## バックアップと復元

毎日のCronは通知の有効・無効に関わらず、本人の農場データをgzip圧縮し、Firestoreの管理者専用領域へ保存します。30日前より古いものを削除します。最新データはアプリの設定画面からJSONとして取得できます。

復元は管理者用 `scripts/restore-backup.mjs` で実施します。本人UIDとバックアップファイルを指定し、サービスアカウントは環境変数だけで渡します。復元は現在の農場データを置き換えるので、先に手動エクスポートを保管し、他の端末からログアウトして実行してください。

## 現時点の制約と本番確認

- プッシュ通知・メール・自動バックアップ・端末間同期は、実アカウントの設定後に実機で確認する必要があります。
- 配信は朝6時固定。時刻の変更はCron設定で行います。
- 前作終了待ちは仮計画として表示します。終了を確認した後、次作の開始日を手動で確定します。
- 概略期間は開始日と終了日で入力します。「月単位」は月初・月末で表示し、播種の日付を確定しません。
- 同じ圃場で複数の作業や栽培が重なる場合、確認表示を出し、利用者が確認して登録します。
- 1回の一括保存は450文書まで。多数の圃場は分けて登録します。
- 完了の取り消しは関連作業があると制限します。実施日訂正は未完了の関連作業へ反映します。
- オフライン編集、地図、写真、経費、在庫、薬剤の適否判定は対象外です。

参考：
- [Firebase Googleログイン](https://firebase.google.com/docs/auth/web/google-signin)
- [Firestoreアクセスルール](https://firebase.google.com/docs/firestore/security/rules-conditions)
- [AppleのWeb Push対応条件](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [Vercel Cronの制約](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Vercel Hobbyの利用条件](https://vercel.com/docs/plans/hobby)
