require('dotenv').config();
const axios = require('axios');

const TOKEN = process.env.COC_API_TOKEN;
let CLAN_TAG = process.env.CLAN_TAG || '';
const INTERVAL = Number(process.env.CHECK_INTERVAL || 60) * 1000;

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT = process.env.TELEGRAM_CHAT_ID;

if (!TOKEN) {
  console.error('Error: COC_API_TOKEN is not set in .env');
  process.exit(1);
}

if (!CLAN_TAG) {
  console.error('Error: CLAN_TAG is not set in .env');
  process.exit(1);
}

if (!CLAN_TAG.startsWith('#')) {
  CLAN_TAG = `#${CLAN_TAG}`;
}

const encodedTag = encodeURIComponent(CLAN_TAG);

const api = axios.create({
  baseURL: 'https://api.clashofclans.com/v1',
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    Accept: 'application/json'
  },
  timeout: 15000
});

function toFixedNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '0';
  }
  return Number(value).toFixed(digits);
}

async function fetchCurrentWar() {
  try {
    const res = await api.get(`/clans/${encodedTag}/currentwar`);
    return res.data;
  } catch (err) {
    if (err.response) {
      console.error('API error:', err.response.status, err.response.data || err.response.statusText);
    } else {
      console.error('Request error:', err.message);
    }
    return null;
  }
}

function formatDateTime(isoString) {
  if (!isoString) return '—';
  try {
    return new Date(isoString).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      dateStyle: 'short',
      timeStyle: 'short'
    });
  } catch {
    return isoString;
  }
}

function buildMemberSummary(side, members, attacksPerMember = 1) {
  if (!Array.isArray(members) || members.length === 0) {
    return `${side}: Tidak ada data member.`;
  }

  const lines = [`${side} Members (detail):`];

  const sortedMembers = [...members].sort((a, b) => (a.mapPosition || 99) - (b.mapPosition || 99));

  for (const member of sortedMembers) {
    const name = member.name || 'Unknown';
    const townHall = member.townhallLevel || 0;
    const mapPos = member.mapPosition || '-';
    const stars = member.stars || 0;
    const destruction = Number(member.destructionPercentage || 0).toFixed(2);
    const usedAttacks = Array.isArray(member.attacks) ? member.attacks.length : 0;
    const bestAttack = member.bestOpponentAttack || null;
    const bestStars = bestAttack ? (bestAttack.stars || 0) : 0;
    const bestDestruction = bestAttack ? (bestAttack.destructionPercentage || 0) : 0;
    const attackState = usedAttacks >= attacksPerMember ? 'Full' : `${usedAttacks}/${attacksPerMember}`;

    lines.push(
      `- ${String(mapPos).padEnd(2)} ${name.padEnd(18)} TH${String(townHall).padEnd(2)} | ` +
      `Stars ${String(stars).padEnd(2)} | Destr ${String(destruction).padEnd(5)}% | ` +
      `Attacks ${attackState} | Best ${bestStars}★/${Number(bestDestruction).toFixed(2)}%`
    );
  }

  return lines.join('\n');
}

function buildAttackLog(members, sideName) {
  if (!Array.isArray(members) || members.length === 0) {
    return `${sideName}: tidak ada log serangan.`;
  }

  const lines = [`${sideName} Attack Log:`];

  let attackCount = 0;

  for (const member of members) {
    const memberAttacks = Array.isArray(member.attacks) ? member.attacks : [];
    if (memberAttacks.length === 0) {
      lines.push(`- ${member.name}: belum menyerang`);
      continue;
    }

    for (const attack of memberAttacks) {
      attackCount += 1;
      const target = attack.defenderTag || 'Unknown';
      const stars = attack.stars || 0;
      const destruction = Number(attack.destructionPercentage || 0).toFixed(2);
      lines.push(`- ${member.name} -> ${target} : ${stars}★ / ${destruction}%`);
    }
  }

  if (attackCount === 0) {
    lines.push('- Belum ada serangan tercatat.');
  }

  return lines.join('\n');
}

function buildWarSummary(data) {
  if (!data) return 'War data tidak tersedia.';

  const clan = data.clan || {};
  const opponent = data.opponent || {};
  const warState = data.state || 'unknown';
  const teamSize = data.teamSize || 0;
  const attacksPerMember = data.attacksPerMember || 1;

  const clanStars = clan.stars || 0;
  const clanDestruction = Number(clan.destructionPercentage || 0).toFixed(2);
  const opponentStars = opponent.stars || 0;
  const opponentDestruction = Number(opponent.destructionPercentage || 0).toFixed(2);

  const summary = [
    `War State: ${warState}`,
    `Clan: ${clan.name || '—'} | Stars: ${clanStars} | Destruction: ${clanDestruction}%`,
    `Opponent: ${opponent.name || '—'} | Stars: ${opponentStars} | Destruction: ${opponentDestruction}%`,
    `Team Size: ${teamSize} | Attacks/Member: ${attacksPerMember}`,
    `Preparation End: ${formatDateTime(data.preparationEndTime)}`,
    `War Start: ${formatDateTime(data.startTime)}`,
    `War End: ${formatDateTime(data.endTime)}`
  ].join('\n');

  const clanDetail = buildMemberSummary('Clan', clan.members || [], attacksPerMember);
  const opponentDetail = buildMemberSummary('Opponent', opponent.members || [], attacksPerMember);
  const clanAttackLog = buildAttackLog(clan.members || [], 'Clan');
  const opponentAttackLog = buildAttackLog(opponent.members || [], 'Opponent');

  return [summary, '', clanDetail, '', opponentDetail, '', clanAttackLog, '', opponentAttackLog].join('\n');
}

async function notifyTelegram(text) {
  if (!TG_TOKEN || !TG_CHAT) return;

  try {
    await axios.post(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      chat_id: TG_CHAT,
      text,
      disable_web_page_preview: true
    });
  } catch (error) {
    console.error('Telegram send failed:', error.message);
  }
}

let lastMessage = null;

async function runOnce() {
  const data = await fetchCurrentWar();
  if (!data) {
    console.log('[' + new Date().toLocaleString('id-ID') + '] Tidak bisa mengambil data war.');
    return;
  }

  const summary = buildWarSummary(data);

  if (summary !== lastMessage) {
    console.log('\n' + '[' + new Date().toLocaleString('id-ID') + ']');
    console.log(summary);
    console.log('\n' + '---');
    await notifyTelegram(`CoC War Update for ${CLAN_TAG}\n\n${summary}`);
    lastMessage = summary;
  } else {
    console.log('[' + new Date().toLocaleString('id-ID') + '] Tidak ada perubahan status war.');
  }
}

(async () => {
  console.log(`Bot sedang berjalan... Clan: ${CLAN_TAG}`);
  console.log(`Interval cek: ${INTERVAL / 1000} detik`);

  await runOnce();
  setInterval(runOnce, INTERVAL);
})();
