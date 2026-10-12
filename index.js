require('dotenv').config();
const axios = require('axios');

const TOKEN = process.env.COC_API_TOKEN;
let CLAN_TAG = (process.env.CLAN_TAG || '').trim();
const INTERVAL = Number(process.env.CHECK_INTERVAL || 60) * 1000;
const MAX_LOG_LINES = Number(process.env.MAX_LOG_LINES || 30);
const SHOW_MEMBER_DETAILS = String(process.env.SHOW_MEMBER_DETAILS || 'true').toLowerCase() === 'true';
const SHOW_ATTACK_LOG = String(process.env.SHOW_ATTACK_LOG || 'true').toLowerCase() === 'true';
const TELEGRAM_NOTIFY_ON_STATE_CHANGE = String(process.env.TELEGRAM_NOTIFY_ON_STATE_CHANGE || 'true').toLowerCase() === 'true';
const TELEGRAM_SEND_ON_START = String(process.env.TELEGRAM_SEND_ON_START || 'false').toLowerCase() === 'true';
const MIN_ATTACKS_TO_BE_ACTIVE = Number(process.env.MIN_ATTACKS_TO_BE_ACTIVE || 1);

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
  timeout: 20000
});

function numberOr(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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

function formatMember(member, attacksPerMember = 1, isActive = false) {
  const name = member.name || 'Unknown';
  const townHall = member.townhallLevel || 0;
  const mapPos = member.mapPosition || '-';
  const stars = member.stars || 0;
  const destruction = numberOr(member.destructionPercentage, 0).toFixed(2);
  const usedAttacks = Array.isArray(member.attacks) ? member.attacks.length : 0;
  const bestAttack = member.bestOpponentAttack || null;
  const bestStars = bestAttack ? numberOr(bestAttack.stars, 0) : 0;
  const bestDestruction = bestAttack ? numberOr(bestAttack.destructionPercentage, 0).toFixed(2) : '0.00';
  const attackState = usedAttacks >= attacksPerMember ? 'Full' : `${usedAttacks}/${attacksPerMember}`;
  const activeMark = isActive ? '*' : ' ';

  return `${activeMark} ${String(mapPos).padEnd(2)} ${name.padEnd(18)} TH${String(townHall).padEnd(2)} | Stars ${String(stars).padEnd(2)} | Destr ${String(destruction).padEnd(5)}% | Attacks ${attackState} | Best ${bestStars}★/${bestDestruction}%`;
}

function getActiveMembers(members, minAttacks = MIN_ATTACKS_TO_BE_ACTIVE) {
  if (!Array.isArray(members)) return { count: 0, names: [] };
  const active = members.filter(m => (Array.isArray(m.attacks) ? m.attacks.length : 0) >= minAttacks);
  const names = active.map(m => m.name || 'Unknown');
  return { count: active.length, names, members: active };
}

function buildMemberSection(side, members, attacksPerMember = 1, minActive = MIN_ATTACKS_TO_BE_ACTIVE) {
  if (!Array.isArray(members) || members.length === 0) {
    return `${side}: Tidak ada data member.`;
  }

  const sorted = [...members].sort((a, b) => (a.mapPosition || 99) - (b.mapPosition || 99));
  const activeInfo = getActiveMembers(members, minActive);
  const lines = [`${side} Members (detail):  Active: ${activeInfo.count}/${members.length} ("*" = aktif)`];

  for (const member of sorted) {
    const isActive = (Array.isArray(member.attacks) ? member.attacks.length : 0) >= minActive;
    lines.push(formatMember(member, attacksPerMember, isActive));
  }

  // Optionally add a short list of active member names (limit to MAX_LOG_LINES)
  if (activeInfo.count > 0) {
    const names = activeInfo.names.slice(0, MAX_LOG_LINES);
    lines.push('', `${side} Active Members (sample up to ${MAX_LOG_LINES}): ${names.join(', ')}`);
  }

  return lines.join('\n');
}

function buildAttackLog(members, sideName, maxLines = MAX_LOG_LINES) {
  if (!Array.isArray(members) || members.length === 0) {
    return `${sideName}: tidak ada log serangan.`;
  }

  const lines = [`${sideName} Attack Log:`];
  let counter = 0;

  for (const member of members) {
    const attacks = Array.isArray(member.attacks) ? member.attacks : [];
    if (attacks.length === 0) {
      lines.push(`- ${member.name || 'Unknown'}: belum menyerang`);
      continue;
    }

    for (const attack of attacks) {
      if (counter >= maxLines) break;
      const defender = attack.defenderTag || 'Unknown';
      const stars = numberOr(attack.stars, 0);
      const destruction = numberOr(attack.destructionPercentage, 0).toFixed(2);
      lines.push(`- ${member.name || 'Unknown'} -> ${defender} : ${stars}★ / ${destruction}%`);
      counter += 1;
    }

    if (counter >= maxLines) break;
  }

  if (counter === 0) {
    lines.push('- Belum ada serangan tercatat.');
  }

  return lines.join('\n');
}

function buildWarSummary(data) {
  if (!data) return 'War data tidak tersedia.';

  const clan = data.clan || {};
  const opponent = data.opponent || {};
  const state = data.state || 'unknown';
  const teamSize = data.teamSize || 0;
  const attacksPerMember = data.attacksPerMember || 1;

  const clanStars = numberOr(clan.stars, 0);
  const clanDestruction = numberOr(clan.destructionPercentage, 0).toFixed(2);
  const oppStars = numberOr(opponent.stars, 0);
  const oppDestruction = numberOr(opponent.destructionPercentage, 0).toFixed(2);

  const clanActive = getActiveMembers(clan.members || [], MIN_ATTACKS_TO_BE_ACTIVE);
  const oppActive = getActiveMembers(opponent.members || [], MIN_ATTACKS_TO_BE_ACTIVE);

  const summary = [
    `War State: ${state}`,
    `Clan: ${clan.name || '—'} | Stars: ${clanStars} | Destruction: ${clanDestruction}%`,
    `Opponent: ${opponent.name || '—'} | Stars: ${oppStars} | Destruction: ${oppDestruction}%`,
    `Team Size: ${teamSize} | Attacks/Member: ${attacksPerMember}`,
    `Active Members: ${clanActive.count}/${Math.max(clan.members ? clan.members.length : 0, teamSize)} (minAttacks=${MIN_ATTACKS_TO_BE_ACTIVE})`,
    `Opponent Active: ${oppActive.count}/${Math.max(opponent.members ? opponent.members.length : 0, teamSize)} (minAttacks=${MIN_ATTACKS_TO_BE_ACTIVE})`,
    `Preparation End: ${formatDateTime(data.preparationEndTime)}`,
    `War Start: ${formatDateTime(data.startTime)}`,
    `War End: ${formatDateTime(data.endTime)}`
  ].join('\n');

  const sections = [summary];

  if (SHOW_MEMBER_DETAILS) {
    sections.push('', buildMemberSection('Clan', clan.members || [], attacksPerMember, MIN_ATTACKS_TO_BE_ACTIVE));
    sections.push('', buildMemberSection('Opponent', opponent.members || [], attacksPerMember, MIN_ATTACKS_TO_BE_ACTIVE));
  }

  if (SHOW_ATTACK_LOG) {
    sections.push('', buildAttackLog(clan.members || [], 'Clan'));
    sections.push('', buildAttackLog(opponent.members || [], 'Opponent'));
  }

  return sections.join('\n');
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

async function notifyTelegram(text) {
  if (!TG_TOKEN || !TG_CHAT) return;

  const MAX = 3800;
  const chunks = [];

  for (let i = 0; i < text.length; i += MAX) {
    chunks.push(text.slice(i, i + MAX));
  }

  for (const chunk of chunks) {
    try {
      await axios.post(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
        chat_id: TG_CHAT,
        text: chunk,
        disable_web_page_preview: true
      });
    } catch (error) {
      const data = error.response && error.response.data ? JSON.stringify(error.response.data) : error.message;
      console.error('Telegram send failed:', data);
      break;
    }
  }
}

let lastMessage = null;
let lastState = null;

async function runOnce() {
  const data = await fetchCurrentWar();
  if (!data) {
    console.log('[' + new Date().toLocaleString('id-ID') + '] Tidak bisa mengambil data war.');
    return { summary: null, currentState: null };
  }

  const summary = buildWarSummary(data);
  const currentState = data.state || 'unknown';

  if (summary !== lastMessage) {
    console.log('\n[' + new Date().toLocaleString('id-ID') + ']');
    console.log(summary);
    console.log('\n---');
    lastMessage = summary;
  } else {
    console.log('[' + new Date().toLocaleString('id-ID') + '] Tidak ada perubahan status war.');
  }

  if (TG_TOKEN && TG_CHAT && TELEGRAM_NOTIFY_ON_STATE_CHANGE) {
    if (lastState === null) {
      lastState = currentState;
    } else if (currentState !== lastState) {
      const changeText = `CoC War state changed for ${CLAN_TAG}: ${lastState} -> ${currentState}\n\n${summary}`;
      await notifyTelegram(changeText);
      lastState = currentState;
    }
  }

  return { summary, currentState };
}

(async () => {
  console.log('=== CoC War Bot Started ===');
  console.log(`Clan: ${CLAN_TAG}`);
  console.log(`Interval cek: ${INTERVAL / 1000} detik`);
  console.log(`Member detail: ${SHOW_MEMBER_DETAILS ? 'ON' : 'OFF'}`);
  console.log(`Attack log: ${SHOW_ATTACK_LOG ? 'ON' : 'OFF'}`);
  console.log(`Telegram notify on state change: ${TELEGRAM_NOTIFY_ON_STATE_CHANGE ? 'ON' : 'OFF'}`);
  console.log(`Telegram send on start (test): ${TELEGRAM_SEND_ON_START ? 'ON' : 'OFF'}`);
  console.log(`Min attacks to count as active: ${MIN_ATTACKS_TO_BE_ACTIVE}`);

  const first = await runOnce();

  if (TELEGRAM_SEND_ON_START && TG_TOKEN && TG_CHAT && first.summary) {
    try {
      await notifyTelegram(`CoC War initial summary for ${CLAN_TAG} (test):\n\n${first.summary}`);
      console.log('Sent initial test summary to Telegram.');
    } catch (e) {
      console.error('Failed to send initial test summary:', e.message);
    }
  }

  setInterval(runOnce, INTERVAL);
})();
