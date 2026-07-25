const { exec } = require('child_process');

const BOT_TOKEN = '8905346574:AAG0VVwiUOAzzMce7F88o3CaEVI6gsmg2oU';
const CHAT_ID = '5368408796';
const TG_HOST = '149.154.167.220';
const API_URL = 'https://' + TG_HOST + '/bot' + BOT_TOKEN;

function tgApi(method, body) {
  return new Promise((resolve, reject) => {
    var cmd = 'curl -sk -H "Host: api.telegram.org"';
    if (body) {
      var jsonStr = JSON.stringify(body);
      cmd += ' -X POST -H "Content-Type: application/json"';
      cmd += " -d '" + jsonStr.replace(/'/g, "'\\''") + "'";
    }
    cmd += ' "' + API_URL + '/' + method + '"';
    exec(cmd, { timeout: 15000 }, (err, stdout) => {
      if (err) return reject(err);
      try { resolve(JSON.parse(stdout)); }
      catch(e) { reject(e); }
    });
  });
}

async function sendTelegram(text) {
  try {
    while (text.length > 4000) {
      var part = text.slice(0, 4000);
      text = text.slice(4000);
      await tgApi('sendMessage', { chat_id: CHAT_ID, text: part, parse_mode: 'HTML' });
    }
    await tgApi('sendMessage', { chat_id: CHAT_ID, text: text, parse_mode: 'HTML' });
  } catch (e) {
    console.error('Telegram error:', e.message);
  }
}

module.exports = { sendTelegram };
