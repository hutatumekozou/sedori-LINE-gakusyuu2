# VPS 運用メモ

この構成は `Next.js + SQLite + storage/uploads` を 1 台の VPS に常駐させる前提です。

## 前提パス

- アプリ: `/opt/mercari-study/current`
- 環境変数: `/etc/mercari-study/mercari-study.env`
- SQLite: `/var/lib/mercari-study/prisma/dev.db`
- 画像: `/var/lib/mercari-study/uploads`
- ログ: `/var/log/mercari-study`

## 使うファイル

- systemd: `deploy/vps/systemd/mercari-study-web.service`
- systemd: `deploy/vps/systemd/mercari-study-discord-bot.service`
- 手動送信 service: `deploy/vps/systemd/mercari-study-send-due.service`
- cron: `deploy/vps/cron/mercari-study-send-due.cron`
- nginx: `deploy/vps/nginx/mercari-study.conf`
- 本番 env ひな形: `deploy/vps/env.production.example`

## 最低限の流れ

1. サーバーにコードを `/opt/mercari-study/current` へ配置
2. `sudo bash deploy/vps/scripts/bootstrap-host.sh`
3. `/etc/mercari-study/mercari-study.env` を本番値へ編集
4. `sudo cp deploy/vps/systemd/mercari-study-web.service /etc/systemd/system/`
5. `sudo cp deploy/vps/systemd/mercari-study-discord-bot.service /etc/systemd/system/`
6. `sudo cp deploy/vps/systemd/mercari-study-send-due.service /etc/systemd/system/`
7. `sudo systemctl daemon-reload`
8. `bash deploy/vps/scripts/deploy-current.sh`
9. `sudo systemctl enable --now mercari-study-web.service mercari-study-discord-bot.service`
10. `sudo cp deploy/vps/cron/mercari-study-send-due.cron /etc/cron.d/mercari-study-send-due`
11. `sudo chmod 644 /etc/cron.d/mercari-study-send-due`
12. `sudo cp deploy/vps/nginx/mercari-study.conf /etc/nginx/sites-available/mercari-study.conf`
13. `server_name` を実ドメインへ変更し、nginx を reload

## 動作確認

- Web: `curl -I http://127.0.0.1:3000`
- Discord Bot: `sudo systemctl status mercari-study-discord-bot.service`
- 手動送信: `sudo systemctl start mercari-study-send-due.service`
- Web ログ: `/var/log/mercari-study/web.log`
- Bot ログ: `/var/log/mercari-study/discord-bot.log`
- 送信ログ: `/var/log/mercari-study/send-due.log`

## 注意

- SQLite と画像保存が同居するため、複数台構成には向きません
- バックアップ対象は `/etc/mercari-study` と `/var/lib/mercari-study`
- `APP_BASE_URL` は ngrok ではなく本番ドメインを設定してください
