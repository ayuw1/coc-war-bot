# COC War Bot

Bot sederhana untuk memantau status war Clash of Clans di Termux menggunakan API Clash of Clans dan token yang disimpan di file `.env`.

## Fitur

- Cek status war clan secara berkala
- Menampilkan ringkasan war
- Menampilkan detail member per clan dan opponent
- Mengirim notifikasi ke Telegram (opsional)
- Dapat dijalankan di Termux dan background process

## Persiapan

1. Install Node.js di Termux:

```bash
pkg update && pkg upgrade
pkg install nodejs git -y
```

2. Clone repo:

```bash
git clone https://github.com/ayuw1/coc-war-bot.git
cd coc-war-bot
```

3. Copy file `.env.example` ke `.env` dan isi data:

```bash
cp .env.example .env
```

Edit file `.env`:

```env
COC_API_TOKEN=your_clash_of_clans_api_token_here
CLAN_TAG=#YOURCLANTAG
CHECK_INTERVAL=60
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

## Mendapatkan API token

- Buka: https://developer.clashofclans.com/
- Buat API key baru
- Salin token ke `COC_API_TOKEN`

## Install dependency

```bash
npm install
```

## Jalankan bot

```bash
npm start
```

## Jalankan di background (Termux)

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

## Catatan

- `CLAN_TAG` bisa ditulis dengan `#` atau tanpa `#`.
- Interval default 60 detik; sesuaikan bila diperlukan.
- API Clash of Clans membatasi request. Jangan terlalu sering mengecek.
- Jangan commit file `.env` ke GitHub.

## Lisensi

MIT
