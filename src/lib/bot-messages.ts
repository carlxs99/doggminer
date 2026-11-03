// Texts and buttons the @Doggminerbot chat sends (English). Pure: shared by the webhook, notifications and tests.
import { MINI_APP_LINK, PRICE, REF_BONUS, REF_SHARE, SWAP, parseRef, referralLink } from './dogg';

export const APP_URL = 'https://doggminer.lovable.app';
export const WEBHOOK_PATH = '/api/public/telegram-webhook';
export const WELCOME_IMAGE = `${APP_URL}/bot-welcome.jpg`;

type Button = { text: string; url?: string; callback_data?: string };
export type BotMessage = { text: string; buttons: Button[][] };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pct = Math.round(REF_SHARE * 100);
const whole = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 3 });

/** Opens the mini app; a /start ref_<id> invite is passed on as the signed start_param so the inviter still gets credit. */
export function appLink(startParam?: string | null) {
  const ref = parseRef(startParam);
  return ref ? referralLink(ref) : MINI_APP_LINK;
}

/** Display name of a player for messages: first name, else @username, else "A friend". */
export function displayName(firstName?: string | null, username?: string | null) {
  return esc(firstName?.trim() || (username ? `@${username}` : 'A friend'));
}

export function welcomeMessage(firstName: string | null | undefined, startParam?: string | null): BotMessage {
  const name = firstName?.trim() ? `, ${esc(firstName.trim())}` : '';
  return {
    text: [
      `🌿👑 <b>Welcome to $DOGG MINER${name}!</b>`,
      '',
      'The freshest grow op on the West Coast is open 24/7 — and it pays in real <b>$DOGG</b> on TON.',
      '',
      '⛏️ <b>Mine</b> — start a 24h shift and watch your stack grow live',
      '🌱 <b>Level up</b> — 500 miners, from Rookie Roller to OG Kingpin',
      '🎯 <b>Hustle</b> — finish tasks and watch ads for bonus $DOGG',
      `👥 <b>Recruit</b> — +${REF_BONUS} $DOGG per friend + ${pct}% of their mining, forever`,
      '💸 <b>Cash out</b> — withdraw straight to your TON wallet',
      '',
      'Your first shift is free. Tap <b>Start Mining</b> and light it up 🔥',
    ].join('\n'),
    buttons: [
      [{ text: '⛏️ Start Mining', url: appLink(startParam) }],
      [{ text: '👥 Invite & Earn', callback_data: 'invite' }, { text: '📖 How it works', callback_data: 'how' }],
      [{ text: '💰 Buy $DOGG', url: SWAP }, { text: '📈 Price', url: PRICE }],
    ],
  };
}

export function howMessage(): BotMessage {
  return {
    text: [
      '📖 <b>How $DOGG MINER works</b>',
      '',
      '<b>1. Start a shift</b> — open the app and tap Start. Your miner works for 24 hours, even with the app closed.',
      '<b>2. Claim</b> — when the shift ends, claim your $DOGG and start the next one.',
      '<b>3. Upgrade</b> — hold more $DOGG (wallet + app balance) and better miners unlock automatically.',
      '<b>4. Bonus $DOGG</b> — tasks, ads and friends add extra to your balance.',
      '<b>5. Withdraw</b> — connect your TON wallet and cash out from 1,000 $DOGG.',
      '',
      'No wallet needed to mine. Only for withdrawals 👛',
    ].join('\n'),
    buttons: [[{ text: '⛏️ Start Mining', url: MINI_APP_LINK }], [{ text: '👥 Invite & Earn', callback_data: 'invite' }]],
  };
}

export function inviteMessage(telegramId: number): BotMessage {
  const link = referralLink(telegramId);
  const pitch = `Mine $DOGG with me on Telegram 🌿⛏️ Free 24h shifts, 500 miners, real withdrawals on TON.`;
  return {
    text: [
      '👥 <b>Invite friends, stack $DOGG</b>',
      '',
      `🎁 <b>+${REF_BONUS} $DOGG</b> for every friend who starts mining`,
      `♾️ <b>${pct}%</b> of everything they mine — for life`,
      '',
      'Your personal link:',
      `<code>${link}</code>`,
    ].join('\n'),
    buttons: [
      [{ text: '📤 Share with friends', url: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(pitch)}` }],
      [{ text: '⛏️ Open the app', url: MINI_APP_LINK }],
    ],
  };
}

export function referralJoinedMessage(recruit: string): BotMessage {
  return {
    text: `🎉 <b>New recruit!</b>\n\n${recruit} just joined $DOGG MINER with your link.\nYou'll get <b>+${REF_BONUS} $DOGG</b> as soon as they start their first mining shift ⛏️`,
    buttons: [[{ text: '👥 Invite more friends', callback_data: 'invite' }]],
  };
}

export function referralQualifiedMessage(recruit: string): BotMessage {
  return {
    text: `💰 <b>+${REF_BONUS} $DOGG earned!</b>\n\n${recruit} started mining, so your bonus is waiting in your referral pot.\nYou also get <b>${pct}%</b> of everything they mine — forever ♾️\n\nOpen <b>Friends</b> in the app to claim it 👇`,
    buttons: [[{ text: '💰 Claim my $DOGG', url: MINI_APP_LINK }]],
  };
}

/** Transaction link on Tonviewer (accepts the hex or base64 hash indexers return); falls back to the recipient wallet. */
export function txLink(hash: string | null | undefined, address: string) {
  if (hash && /^[0-9a-f]{64}$/i.test(hash)) return `https://tonviewer.com/transaction/${hash.toLowerCase()}`;
  if (hash) {
    try {
      const bin = atob(hash.replace(/-/g, '+').replace(/_/g, '/'));
      if (bin.length === 32) return `https://tonviewer.com/transaction/${[...bin].map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('')}`;
    } catch { /* not base64 */ }
  }
  return `https://tonviewer.com/${encodeURIComponent(address)}`;
}

const shortAddr = (a: string) => (a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-6)}` : a);

export function withdrawalSentMessage(w: { amount: number; address: string; txHash: string | null }): BotMessage {
  return {
    text: `✅ <b>Withdrawal sent!</b>\n\n💸 Amount: <b>${whole(w.amount)} $DOGG</b>\n👛 To: <code>${esc(shortAddr(w.address))}</code>\n\nIt's confirmed on the TON blockchain. Keep stacking 🌿`,
    buttons: [[{ text: '🔎 View transaction', url: txLink(w.txHash, w.address) }], [{ text: '⛏️ Back to mining', url: MINI_APP_LINK }]],
  };
}

export function withdrawalReturnedMessage(w: { amount: number; fee: number }): BotMessage {
  return {
    text: `⚠️ <b>Withdrawal returned</b>\n\nYour withdrawal of <b>${whole(w.amount)} $DOGG</b> couldn't be completed, so <b>${whole(w.amount + w.fee)} $DOGG</b> (fee included) went back to your app balance.\nYou can try again anytime.`,
    buttons: [[{ text: '⛏️ Open the app', url: MINI_APP_LINK }]],
  };
}
