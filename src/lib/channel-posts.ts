// Weekly posts for the @doggnewschannel announcement channel (English). Pure: shared by the weekly job, the first manual post and tests.
import { AD_DAILY, AD_REWARD, MINI_APP_LINK, PRICE, REF_BONUS, REF_SHARE, SWAP } from './dogg';
import { APP_URL } from './bot-messages';
import { VERIFY_BUY } from './purchase';

export const CHANNEL = '@doggnewschannel';
/** Telegram's limit for a photo caption. */
export const CAPTION_LIMIT = 1024;
/** Monday of the week the channel launched (UTC): week 0 = the intro post. */
export const CHANNEL_EPOCH = Date.UTC(2026, 10, 2);
const WEEK_MS = 7 * 86400000;

type Button = { text: string; url: string };
export type ChannelStats = { players: number; withdrawn: number };
export type ChannelPost = { image: string; caption: string; buttons: Button[][] };

const pct = Math.round(REF_SHARE * 100);
const num = (n: number) => Math.floor(n).toLocaleString('en-US');
const open = (text = '⛏️ Open $DOGG MINER'): Button[] => [{ text, url: MINI_APP_LINK }];
const buyRow: Button[] = [{ text: '💰 Buy $DOGG', url: SWAP }, { text: '📈 Price', url: PRICE }];

const POSTS: ((s?: ChannelStats) => { caption: string; buttons: Button[][] })[] = [
  () => ({
    caption: [
      '🌿👑 <b>$DOGG MINER is open for business!</b>',
      '',
      'The West Coast grow op that pays in real <b>$DOGG</b> on TON — right inside Telegram.',
      '',
      '⛏️ <b>Mine</b> — start a free 24h shift, your stack grows live',
      '🌱 <b>Level up</b> — 500 miners, from Rookie Roller to OG Kingpin',
      `🎯 <b>Hustle</b> — tasks + ads (+${AD_REWARD} $DOGG each)`,
      `👥 <b>Recruit</b> — +${REF_BONUS} $DOGG per homie + ${pct}% of their mining, forever`,
      '💸 <b>Cash out</b> — withdraw straight to your TON wallet',
      '',
      'No wallet needed to start. One tap and you\'re in the hood 👇',
      '',
      '🔥 React if you\'re lighting up your first shift today!',
    ].join('\n'),
    buttons: [open('⛏️ Start mining now'), buyRow],
  }),
  () => ({
    caption: [
      '⏳ <b>How a shift works</b>',
      '',
      '1️⃣ Open the app and tap <b>Start</b>',
      '2️⃣ Your miner works for <b>24 hours</b> — even with Telegram closed',
      '3️⃣ Watch the counter climb in real time 📈',
      '4️⃣ When the timer hits zero, <b>Claim</b> and start the next one',
      '',
      'Never miss a shift = never stop stacking 🌿',
      '',
      '💡 <i>Pro tip:</i> set a daily reminder so your miner never sits idle.',
      '',
      '⏰ Did you claim today? Drop a 🔥',
    ].join('\n'),
    buttons: [open('⛏️ Claim / start my shift')],
  }),
  () => ({
    caption: [
      '🌱 <b>500 miners. 10 ranks. One kingpin.</b>',
      '',
      'Rookie Rollers → Street Sprouts → Backyard Growers → West Coast Growers → Lowrider Hustlers → Chronic Crew → Gold Chain Gang → Smoke Kings → Magma OGs → Legendarios 👑',
      '',
      'Every level mines more $DOGG per day — and the plant gets bigger, greener and more legendary 🪴➡️🌳',
      '',
      'Your miner <b>unlocks automatically</b> based on what you hold (wallet + app balance). No buttons, no waiting.',
      '',
      '🤔 Which rank are you on right now? Show us with a reaction:',
      '🌱 Rookie · 🔥 Mid-tier · 👑 Legendario',
    ].join('\n'),
    buttons: [open('🌱 See my miner'), buyRow],
  }),
  () => ({
    caption: [
      '👥 <b>Bring the homies, stack the $DOGG</b>',
      '',
      `🎁 <b>+${REF_BONUS} $DOGG</b> for every friend who starts mining`,
      `♾️ <b>${pct}%</b> of everything they mine — <b>for life</b>`,
      '',
      'Your friends keep 100% of their rewards. Your cut is a bonus on top 💰',
      '',
      'How to get your link:',
      '➡️ Open the app → <b>Friends</b> → copy & share',
      '',
      '🏆 Who\'s building the biggest crew this week? 👀',
    ].join('\n'),
    buttons: [open('👥 Get my invite link')],
  }),
  () => ({
    caption: [
      '🎯 <b>Daily hustle = bonus $DOGG</b>',
      '',
      `📺 Watch up to <b>${AD_DAILY} ads a day</b> → <b>+${AD_REWARD} $DOGG</b> each`,
      '✅ Join channels & bots in the <b>Tasks</b> tab for extra rewards',
      '⛏️ Keep your shift running while you hustle',
      '',
      `That\'s up to <b>${AD_DAILY * AD_REWARD} $DOGG/day</b> just from ads 🔥`,
      '',
      'New tasks drop regularly — check the Tasks tab often 👀',
      '',
      '💬 React ⚡ if you already finished today\'s hustle!',
    ].join('\n'),
    buttons: [open('🎯 Do today\'s tasks')],
  }),
  () => ({
    caption: [
      '💸 <b>Cash out to your TON wallet</b>',
      '',
      '1️⃣ Go to <b>Profile</b> and connect your TON wallet (Tonkeeper & co.)',
      `2️⃣ One-time check: hold at least <b>${VERIFY_BUY} $DOGG</b> in that wallet`,
      '3️⃣ Withdraw from <b>1,000 $DOGG</b> — sent on-chain automatically',
      '',
      'The bot pings you the moment your $DOGG lands ✅',
      '',
      '🔐 Mining never needs a wallet. Only withdrawals do.',
      '',
      '🤑 Who\'s cashing out this week? 🔥',
    ].join('\n'),
    buttons: [open('💸 Withdraw my $DOGG'), buyRow],
  }),
  () => ({
    caption: [
      '👑 <b>Hold more, mine more</b>',
      '',
      'Your miner level follows your <b>real holdings</b>:',
      '👛 $DOGG in your connected wallet',
      '➕ $DOGG in your app balance',
      '',
      '📈 Hold more → better miner unlocks instantly',
      '📉 Sell → your miner drops to the level you cover',
      '',
      'Buy on DeDust, keep it in your wallet and watch your daily rate climb 🌿',
      '',
      '💎 Diamond hands react 💎',
    ].join('\n'),
    buttons: [buyRow, open('⛏️ Check my level')],
  }),
  s => ({
    caption: [
      '📰 <b>HOOD REPORT — weekly $DOGG MINER news</b>',
      '',
      ...(s ? [`🌿 Miners in the hood: <b>${num(s.players)}</b>`, `💸 $DOGG withdrawn on-chain: <b>${num(s.withdrawn)}</b>`, ''] : []),
      'Checklist for this week:',
      '☑️ Claim & restart your 24h shift every day',
      `☑️ Watch your ${AD_DAILY} ads (+${AD_REWARD} $DOGG each)`,
      '☑️ Finish new tasks',
      `☑️ Invite 1 homie (+${REF_BONUS} $DOGG + ${pct}% forever)`,
      '',
      'Stay lit, keep stacking 🔥👑',
      '',
      '👇 React with your favorite: ⛏️ mining · 👥 friends · 🎯 tasks',
    ].join('\n'),
    buttons: [open(), buyRow],
  }),
];

export const CHANNEL_POST_COUNT = POSTS.length;

/** Weeks since the channel launched (Monday-based, UTC). */
export const weekNumber = (now: Date) => Math.floor((now.getTime() - CHANNEL_EPOCH) / WEEK_MS);
/** One post per week: the key stops the weekly job from posting twice. */
export const weekKey = (now: Date) => `w${weekNumber(now)}`;
/** Rotates through the posts in order, then starts over. */
export const postIndexFor = (now: Date) => ((weekNumber(now) % POSTS.length) + POSTS.length) % POSTS.length;

export function channelPost(index: number, stats?: ChannelStats): ChannelPost {
  const i = ((index % POSTS.length) + POSTS.length) % POSTS.length;
  const p = POSTS[i]!(stats);
  return { ...p, image: `${APP_URL}/channel/week-${i + 1}.jpg` };
}
