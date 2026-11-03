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

// ---------- Fresh AI posts (every week after the launch post) ----------

/** Rotating story angles that steer the writer towards variety; history keeps it from repeating any of them. */
export const ANGLES = [
  'a day in the life of a $DOGG miner, hour by hour',
  'myth vs fact about mining $DOGG',
  '3 rookie mistakes and how to avoid them',
  'pro routine to squeeze the most $DOGG out of every day',
  'rank spotlight: what changes as you climb the 10 miner ranks',
  'a quick quiz the reader answers with reactions',
  'weekend grind checklist',
  'story: the road from Rookie Roller to OG Kingpin',
  'math breakdown: what ads alone add up to in a week',
  'referral math: what a crew of 5 active friends means for you',
  'step-by-step: your first withdrawal to a TON wallet',
  'hood glossary: the slang of the app explained (shift, hold, crew, stack)',
  'challenge of the week (bragging rights only, no prizes)',
  'mini FAQ: the questions new players ask most',
  'why holding upgrades your miner automatically',
  'lowrider cruise night theme: keep your shift rolling',
  'wallet safety tips: never share your seed phrase',
  'set-and-forget: reminders so your miner never sits idle',
  'the plant grows with you: from sprout to legendary tree',
  'Monday motivation from the hood',
  'how the bot keeps you posted (withdrawals, recruits)',
  'tasks tab tour: channels, bots and quick rewards',
  'compare: casual player week vs grinder week',
  'what to do in your first 5 minutes in the app',
  'throwback to the launch and what the hood built since',
  'cash-out checklist before you hit withdraw',
  'crew building tips: who to invite and how to pitch it',
  'smoke break wisdom: patience, consistency, stacking',
  'three ways to earn without buying anything',
  'how hold + app balance decide your rank',
];

export type WriterContext = { week: number; stats?: ChannelStats | undefined; history: { title: string | null; angle: string | null }[] };

export function writerInstructions() {
  return [
    'You write the weekly English post for "$DOGG NEWS", the Telegram announcement channel of $DOGG MINER, a Telegram mini app.',
    'Voice: West Coast hip-hop / 420 culture, laid-back, confident, fun slang, emojis. Interactive: talk to the reader, and end with a call to react with specific emojis or answer a question.',
    '',
    'FACTS (the only facts you may use; never invent features, events, giveaways, prizes, partnerships, dates, prices or numbers):',
    '- Free to play inside Telegram via @Doggminerbot. Rewards are real $DOGG, a jetton on the TON blockchain.',
    '- Mining runs in 24-hour shifts: tap Start, the miner works even with Telegram closed, the counter climbs live, then Claim and start the next shift.',
    `- 500 miners in 10 ranks of 50: ${['Rookie Rollers', 'Street Sprouts', 'Backyard Growers', 'West Coast Growers', 'Lowrider Hustlers', 'Chronic Crew', 'Gold Chain Gang', 'Smoke Kings', 'Magma OGs', 'Legendarios'].join(', ')}. Higher ranks mine more $DOGG per day; the art shows a better plant and better spot at each rank.`,
    '- The miner level is automatic: it follows the $DOGG the player holds (connected TON wallet + app balance). Hold more = better miner; sell = it drops to the level covered.',
    `- Ads: up to ${AD_DAILY} rewarded ads per day, +${AD_REWARD} $DOGG each. Tasks tab: join channels/bots for extra rewards.`,
    `- Referrals: +${REF_BONUS} $DOGG when an invited friend starts their first shift, plus ${pct}% of everything they mine, for life; the friend keeps 100%.`,
    `- Withdrawals: from 1,000 $DOGG (70 $DOGG fee) straight to the player's TON wallet, sent automatically on-chain; one-time check that the wallet holds at least ${VERIFY_BUY} $DOGG. Mining never needs a wallet, only withdrawing does.`,
    '- $DOGG can be bought on DeDust (there is a button under the post). The app is in English, Spanish and Russian. The bot sends notifications for withdrawals and new recruits.',
    '',
    'RULES:',
    '- Never give financial advice or promise profits or price moves. Never name real celebrities.',
    '- Caption: 450-900 characters, short lines, Telegram HTML only (<b> and <i>), no links, no hashtags spam (max 2).',
    '- Pick an angle that is NOT in the previous posts list; the title and the content must be clearly different from every previous post.',
    '- image_headline: 1-3 words, max 18 characters, ALL CAPS, punchy. image_subline: max 32 characters, ALL CAPS.',
    '- image_scene: one or two sentences describing what the DOGG character (a cartoon dog rapper) is doing and where, matching the angle; no text in the scene.',
    '- button_text: short call to action that opens the app, max 26 characters, starting with an emoji.',
  ].join('\n');
}

export function writerPrompt(ctx: WriterContext) {
  const prev = ctx.history.filter(h => h.title || h.angle).map(h => `- ${h.title ?? ''}${h.angle ? ` (angle: ${h.angle})` : ''}`);
  const stats = ctx.stats ? `Live numbers you may quote: ${num(ctx.stats.players)} miners in the hood, ${num(ctx.stats.withdrawn)} $DOGG withdrawn on-chain so far.` : 'No live numbers available this week: do not quote any player or withdrawal counts.';
  return [
    `This is weekly post #${ctx.week}.`,
    `Suggested angle: ${ANGLES[((ctx.week % ANGLES.length) + ANGLES.length) % ANGLES.length]}. If it (or something close) appears in the previous posts, choose a different fresh angle.`,
    stats,
    '',
    'Previous posts (never repeat these):',
    ...(prev.length ? prev : ['- (none)']),
  ].join('\n');
}

const clip = (s: string, max: number) => (s.length > max ? s.slice(0, max).trimEnd() : s);

/** Keeps only the Telegram HTML the posts use (<b>, <i>); anything else is shown as text. Unbalanced tags fall back to plain text. */
export function sanitizeCaption(raw: string) {
  let s = raw.replace(/\r/g, '').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/<\/?(strong)>/gi, m => m.replace(/strong/i, 'b')).replace(/<\/?(em)>/gi, m => m.replace(/em/i, 'i'));
  s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/&lt;(\/?)(b|i)&gt;/gi, (_, slash: string, tag: string) => `<${slash}${tag.toLowerCase()}>`);
  const balanced = (['b', 'i'] as const).every(t => (s.match(new RegExp(`<${t}>`, 'g')) ?? []).length === (s.match(new RegExp(`</${t}>`, 'g')) ?? []).length);
  if (!balanced) s = s.replace(/<\/?(b|i)>/g, '');
  s = s.replace(/\n{3,}/g, '\n\n').trim();
  if (s.length > CAPTION_LIMIT - 24) {
    const cut = s.slice(0, CAPTION_LIMIT - 24);
    s = cut.slice(0, Math.max(cut.lastIndexOf('\n'), 400)).replace(/<\/?(b|i)>/g, '').trim();
    if (s.length > CAPTION_LIMIT - 24) s = s.slice(0, CAPTION_LIMIT - 24);
  }
  return s;
}

export type AiPostDraft = { angle: string; title: string; caption: string; button_text: string; image_headline: string; image_subline: string; image_scene: string };

export function normalizeAiPost(d: AiPostDraft): AiPostDraft {
  const caps = (s: string, max: number) => clip(s.replace(/["“”<>]/g, '').replace(/\s+/g, ' ').trim().toUpperCase(), max);
  const button = clip(d.button_text.replace(/\s+/g, ' ').trim(), 30);
  return {
    angle: clip(d.angle.trim(), 160),
    title: clip(d.title.replace(/<[^>]*>/g, '').trim(), 120),
    caption: sanitizeCaption(d.caption),
    button_text: button.length >= 3 ? button : '⛏️ Open $DOGG MINER',
    image_headline: caps(d.image_headline, 22) || 'DOGG NEWS',
    image_subline: caps(d.image_subline, 40),
    image_scene: clip(d.image_scene.replace(/["“”]/g, '').trim(), 400),
  };
}

export function aiPostButtons(buttonText: string | null | undefined): Button[][] {
  return [open(buttonText || '⛏️ Open $DOGG MINER'), buyRow];
}

/** Edit prompt for the reference cover: same character and style, new scene and headline. */
export function imagePrompt(d: Pick<AiPostDraft, 'image_headline' | 'image_subline' | 'image_scene'>) {
  return [
    'Keep the exact same DOGG character from the reference (cartoon dog rapper with braids, black cap with a small gold crown, dark sunglasses, gold chain, black hoodie) and the same art style: black background with neon green smoke, gold accents, graffiti green-and-white title font.',
    'Wide 16:9 Telegram channel image.',
    `Left side: big graffiti title "${d.image_headline}"${d.image_subline ? ` and a smaller clean line "${d.image_subline}"` : ''}.`,
    `Right side: ${d.image_scene}`,
    'Professional, crisp, high detail. No other text, no logos, no watermarks.',
  ].join(' ');
}
