const { exec } = require('child_process');

const BOT_TOKEN = '8905346574:AAG0VVwiUOAzzMce7F88o3CaEVI6gsmg2oU';
const CHAT_ID = '5368408796';
// Пул IP Telegram API (сеть к api.telegram.org с VPS нестабильна — перебираем)
const TG_IPS = ['149.154.167.220', '149.154.167.99', '149.154.166.110', '91.108.56.100', '149.154.175.50'];
const API_HOST = 'api.telegram.org';

function runCurl(ip, url, body) {
  return new Promise((resolve, reject) => {
    var cmd = 'curl -sk -m 12 --resolve ' + API_HOST + ':443:' + ip;
    if (body) {
      var jsonStr = JSON.stringify(body);
      cmd += ' -X POST -H "Content-Type: application/json"';
      cmd += " -d '" + jsonStr.replace(/'/g, "'\\''") + "'";
    }
    cmd += ' "' + url + '"';
    exec(cmd, { timeout: 15000 }, (err, stdout) => {
      if (err) return reject(err);
      try { resolve(JSON.parse(stdout)); }
      catch (e) { reject(e); }
    });
  });
}

// Запрос с перебором IP и повторами (сеть к Telegram нестабильна)
async function tgApi(method, body, attempts) {
  const maxAttempts = attempts || 4;
  const url = 'https://' + API_HOST + '/bot' + BOT_TOKEN + '/' + method;
  for (let a = 0; a < maxAttempts; a++) {
    for (const ip of TG_IPS) {
      try {
        const res = await runCurl(ip, url, body);
        if (res && res.ok) return res;
        if (res && res.error_code === 409) return res; // webhook conflict — не ретраим
      } catch (e) { /* пробуем следующий IP */ }
    }
    if (a < maxAttempts - 1) await new Promise(r => setTimeout(r, 4000));
  }
  throw new Error('Telegram API unreachable after ' + maxAttempts + ' attempts');
}

async function sendTelegram(text) {
  try {
    const parts = [];
    while (text.length > 4000) {
      parts.push(text.slice(0, 4000));
      text = text.slice(4000);
    }
    parts.push(text);
    for (const part of parts) {
      await tgApi('sendMessage', { chat_id: CHAT_ID, text: part, parse_mode: 'HTML' });
    }
    return true;
  } catch (e) {
    console.error('Telegram error:', e.message);
    return false;
  }
}

// Отправка конкретному chat_id (для агентов)
async function sendTelegramTo(chatId, text) {
  if (!chatId) return false;
  try {
    const res = await tgApi('sendMessage', { chat_id: chatId, text: String(text).slice(0, 4000), parse_mode: 'HTML' });
    return !!(res && res.ok);
  } catch (e) {
    console.error('Telegram send error:', e.message);
    return false;
  }
}

// Установка webhook (Telegram сам шлёт апдейты на наш сервер)
async function setWebhook(url) {
  try {
    const res = await tgApi('setWebhook', { url: url }, 6);
    return !!(res && res.ok);
  } catch (e) {
    console.error('Telegram setWebhook error:', e.message);
    return false;
  }
}

module.exports = { sendTelegram, sendTelegramTo, setWebhook };
module.exports.CHAT_ID = CHAT_ID;
