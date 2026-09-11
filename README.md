# sj-player-watch

日本バドミントン協会のS/Jリーグ（男女各12チーム）の選手欄を3時間ごとに監視し、変更時だけntfyへ通知するCloudflare Workerです。初回はKVへbaselineを保存するだけで通知しません。

## セットアップとデプロイ

必要なものはBun、Cloudflareアカウント、ntfyアプリです。Node.jsサーバーやDockerは不要です。

```bash
bun install
bunx wrangler login

# KV namespaceを作成し、出力されたidを控える
bunx wrangler kv namespace create WATCH_STATE
```

作成されたIDを`wrangler.jsonc`の`kv_namespaces[0].id`へ設定します。その後、推測されにくい長いtopic名を決めてSecretへ登録します。

```bash
bunx wrangler secret put NTFY_TOPIC
bun run types
bun run typecheck
bun test
bun run dev
bun run deploy
```

ntfyアプリをインストールし、Secretに登録したものと同じtopicを購読してください。変更通知をタップすると該当チームのページが開きます。公開の`ntfy.sh`ではtopic名を知る人が購読できるため、十分にランダムな名前を推奨します。

## ローカル確認

`bun run dev`はScheduled Handlerのローカルテストを有効にします。別ターミナルから次を実行します。ローカルKVは本番KVとは別に永続化されます。`NTFY_TOPIC`は`.dev.vars`へ設定できますが、このファイルをコミットしないでください。

```bash
curl http://localhost:8787/
curl "http://localhost:8787/cdn-cgi/local/scheduled?format=json"
```

`GET /`以外の通常HTTP endpointは404です。監視を起動する独自の無認証endpointは設けていません。

## 動作

- 男子一覧と`?gender=female`の女子一覧から`.v-team__card`を読み、チーム名と詳細URLを自動検出します。
- 詳細ページの`.v-player-list__player-area .p-player__item`だけから氏名・背番号を抽出します。Staffやfooter等は比較対象外です。
- 空白を正規化し、順序に依存しない集合として比較します。背番号変更は旧情報の削除と新情報の追加として通知します。
- チーム取得は最大3並列です。HTTPエラー、timeout、選手欄欠落、空データの場合はそのチームのKVを更新しません。
- Cron `17 */3 * * *`はUTC基準ですが、約3時間ごとの実行を目的としています。

## 運用上の注意

チーム一覧自体の取得に失敗した場合は実行全体を中止します。個別チームの失敗はログへ記録し、残りのチームを続行します。通知送信に失敗した場合もKVを更新しないため、次回に再通知を試みます。
