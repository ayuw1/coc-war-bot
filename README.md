# CoC War Bot

Bot sederhana untuk memantau status war Clash of Clans di Termux dengan API resmi Clash of Clans. Bot ini mengecek `currentwar` clan, menampilkan detail member, log serangan, dan hanya mengirim notifikasi ke Telegram saat state war berubah.

## Fitur

- Cek status war clan secara berkala
- Menampilkan ringkasan war
- Menampilkan detail member clan dan opponent
- Menampilkan log serangan per member
- Notifikasi Telegram hanya saat state war berubah
- Dapat dijalankan di Termux dan tetap berjalan di background

## Persiapan di Termux

```bash
pkg update && pkg upgrade
pkg install nodejs git -y
```

## Clone repo

```bash
git clone https://github.com/ayuw1/coc-war-bot.git
cd coc-war-bot
```

## Konfigurasi

Salin file contoh ke `.env`:

```bash
cp .env.example .env
```

Kemudian edit isi `.env`:

```env
# Clash of Clans API token from developer.clashofclans.com
COC_API_TOKEN=your_clash_of_clans_api_token_here

# Clan tag, bisa dengan # atau tanpa #
CLAN_TAG=#YOURCLANTAG

# Cek status war tiap N detik (default 60)
CHECK_INTERVAL=60

# Batasi jumlah log serangan yang ditampilkan
MAX_LOG_LINES=30

# Tampilkan detail member dan log attack
SHOW_MEMBER_DETAILS=true
SHOW_ATTACK_LOG=true

# Telegram: hanya kirim saat state war berubah
TELEGRAM_NOTIFY_ON_STATE_CHANGE=true

# Jika mau tes Telegram saat bot mulai, set true untuk mengirim ringkasan awal (sekali)
TELEGRAM_SEND_ON_START=false

TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

### Penjelasan variabel

- `COC_API_TOKEN`: API key dari Clash of Clans Developer Portal
- `CLAN_TAG`: tag clan, contoh `#ABCD1234`
- `CHECK_INTERVAL`: interval pengecekan dalam detik
- `MAX_LOG_LINES`: jumlah log serangan yang ditampilkan
- `SHOW_MEMBER_DETAILS`: `true` / `false`
- `SHOW_ATTACK_LOG`: `true` / `false`
- `TELEGRAM_NOTIFY_ON_STATE_CHANGE`: `true` agar Telegram hanya kirim saat state berubah
- `TELEGRAM_SEND_ON_START`: `true` untuk mengirim ringkasan war awal satu kali saat bot mulai (untuk pengujian)
- `TELEGRAM_BOT_TOKEN`: token bot Telegram (opsional)
- `TELEGRAM_CHAT_ID`: chat id tujuan notifikasi (opsional)

## Mendapatkan token Clash of Clans

Buka:
https://developer.clashofclans.com/

Lalu buat API key baru, lalu salin token ke `COC_API_TOKEN`.

## Install dependency

```bash
npm install
```

## Jalankan bot

```bash
npm start
```

## Jalankan di background di Termux

```bash
nohup npm start >/dev/null 2>&1 &
```

Atau gunakan `pm2`:

```bash
npm install -g pm2
pm2 start index.js --name coc-war-bot
pm2 save
pm2 startup
```

## Contoh output

```text
=== CoC War Bot Started ===
Clan: #YOURCLANTAG
Interval cek: 60 detik
Member detail: ON
Attack log: ON
Telegram notify on state change: ON
Telegram send on start (test): OFF

[12/10/2026, 12:00:00]
War State: inWar
Clan: Dark Legion | Stars: 40 | Destruction: 71.25%
Opponent: Thunder Riders | Stars: 35 | Destruction: 62.10%
Team Size: 15 | Attacks/Member: 2
Preparation End: 12/10/2026 12:00
War Start: 12/10/2026 12:05
War End: 12/10/2026 13:05

Clan Members (detail):
- 1  PlayerA             TH13 | Stars 5 | Destr 75.00% | Attacks 2/2 | Best 3★/62.50%
- 2  PlayerB             TH12 | Stars 2 | Destr 31.00% | Attacks 0/2 | Best 0★/0.00%

Clan Attack Log:
- PlayerA -> #PPQ12345 : 3★ / 75.00%
```

## Catatan penting

- Jangan pernah commit file `.env` ke GitHub.
- API Clash of Clans memiliki batas rate limit; hindari mengecek terlalu cepat.
- Jika war tidak sedang berjalan, API bisa mengembalikan status `notFound` atau state lain yang sesuai.
- Telegram hanya dikirim saat state war berubah, untuk mencegah spam notifikasi.

## Lisensi

MIT

## Repo

https://github.com/ayuw1/coc-war-bot
