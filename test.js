// 🚀 MAQXPrizeBot – Telegram Referral + X Verification
// Dependencies: node-telegram-bot-api, node-fetch, fs
// Environment variables (Render):
// BOT_TOKEN=your_telegram_token
// TWITTER_BEARER_TOKEN=your_twitter_bearer_token
// TWITTER_TARGET_ID=1780193553671333888   (numeric id of @MAQX_io)
// TELEGRAM_GROUP=MaqxRevolution            (group username, without @)

const TelegramBot = require("node-telegram-bot-api");
const fetch = require("node-fetch");
const fs = require("fs");

// Load env vars
const token = process.env.BOT_TOKEN;
const twitterBearer = process.env.TWITTER_BEARER_TOKEN;
const maqxId = process.env.TWITTER_TARGET_ID;
const groupUsername = process.env.TELEGRAM_GROUP || "MaqxRevolution";

const bot = new TelegramBot(token, { polling: true });

// === Data handling ===
const DATA_FILE = "./users.json";
let users = {};
if (fs.existsSync(DATA_FILE)) {
  try {
    users = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    users = {};
  }
}
const saveData = () => fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));

// === Helpers ===

// 🔹 Verify Telegram group join
async function isMember(userId) {
  try {
    const member = await bot.getChatMember(`@${groupUsername}`, userId);
    return (
      member.status === "member" ||
      member.status === "administrator" ||
      member.status === "creator"
    );
  } catch {
    return false;
  }
}

// 🔹 Verify X (Twitter) follow
async function followsMaqx(username) {
  try {
    // get target user by username
    const userResp = await fetch(
      `https://api.twitter.com/2/users/by/username/${username}`,
      { headers: { Authorization: `Bearer ${twitterBearer}` } }
    );
    const userData = await userResp.json();
    if (!userData.data) return false;

    // check following list
    const followResp = await fetch(
      `https://api.twitter.com/2/users/${userData.data.id}/following?max_results=1000`,
      { headers: { Authorization: `Bearer ${twitterBearer}` } }
    );
    const followData = await followResp.json();
    if (!followData.data) return false;

    return followData.data.some((u) => u.id === maqxId);
  } catch (err) {
    console.error("❌ Twitter check failed:", err.message);
    return false;
  }
}

// === Commands ===

// 🧭 /start
bot.onText(/\/start (.+)?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const referrerId = match[1];

  if (!users[chatId]) {
    users[chatId] = { invites: 0, invitedBy: referrerId || null, verified: false };
    saveData();

    if (referrerId && users[referrerId]) {
      users[referrerId].invites += 1;
      saveData();
      bot.sendMessage(
        referrerId,
        "🎉 Someone joined using your invite link! You've earned a point."
      );
    }

    const link = `https://t.me/${bot.me.username}?start=${chatId}`;
    bot.sendMessage(
      chatId,
      `👋 Welcome! Here’s your referral link:\n${link}\n\nPlease verify both:\n1️⃣ Join @${groupUsername}\n2️⃣ Reply here with your X username (without @) to verify follow.`
    );
  } else {
    bot.sendMessage(chatId, "⚠️ You are already registered.");
  }
});

// 🧾 Listen for X username reply
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  if (!text || text.startsWith("/")) return;

  if (users[chatId] && !users[chatId].verified) {
    bot.sendMessage(chatId, "⏳ Checking your membership and follow status...");
    const member = await isMember(chatId);
    const follows = await followsMaqx(text);
    if (member && follows) {
      users[chatId].verified = true;
      saveData();
      bot.sendMessage(chatId, "✅ Verified! You are now eligible for rewards.");
    } else {
      bot.sendMessage(
        chatId,
        `❌ Verification failed.\nMake sure you joined @${groupUsername} and followed @MAQX_io.`
      );
    }
  }
});

// 🏅 /score
bot.onText(/\/score/, (msg) => {
  const chatId = msg.chat.id;
  const score = users[chatId]?.invites || 0;
  bot.sendMessage(chatId, `🏅 Your score: ${score}`);
});

// 🏆 /leaderboard
bot.onText(/\/leaderboard/, (msg) => {
  const top = Object.entries(users)
    .sort(([, a], [, b]) => b.invites - a.invites)
    .slice(0, 5)
    .map(([id, u], i) => `${i + 1}. ${id} — ${u.invites} points`)
    .join("\n");
  bot.sendMessage(msg.chat.id, `🏆 Top Referrers:\n${top || "No data yet."}`);
});

// === Start ===
console.log("🤖 MAQXPrizeBot running...");
