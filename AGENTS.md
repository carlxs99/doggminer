<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep five DOGG content screens as independent TanStack routes with a shared shell and game-state provider so navigation preserves the active shift.
- Isolate TON Connect in a dynamically imported component behind ClientOnly because wallet SDKs require browser APIs.
- All durable mining mutations must verify Telegram initData server-side and use the row-locking database function; never trust client elapsed time or client reward amounts.
- Preview credits are ephemeral React state and never represent on-chain balances; read jetton balances independently through TONAPI.
- Miner changes checkpoint accumulated credit at the bounded shift time and apply the new daily rate prospectively; keep demo calculation and database miner catalog aligned.
- Pre-optimize shared UI and lazy wallet dependencies and reject outdated optimizer requests so preview updates cannot mix separate React module generations.
- Real hold = TONAPI jetton balance of the TON Connect wallet linked to the Telegram account plus in-app balance; linking requires a server-verified ton_proof whose payload is HMAC-bound to the Telegram id (a valid proof releases the wallet from any other account), and hold is checked server-side on every action because client balances cannot be trusted.
- Withdrawals: DB function deducts balance and queues atomically; src/lib/payout.server.ts pays from the PAYOUT_MNEMONIC wallet through a fetch-based toncenter client (no axios, edge runtime) under one DB lock, recording each attempt (seqno, query_id) before sending, sending the next only after the previous seqno executes, and confirming on-chain by query_id; a scheduled job (/api/public/jobs/payouts) retries and reconciles: confirmed → sent, bounced → refund, expired unexecuted → requeue, executed but unconfirmed → stays 'sending' for manual review, because auto-refunding an unconfirmed send could double-pay; low wallet funds keep rows queued instead of refunding.
- Miner tier art is square: each sq-tier-N clip starts and ends on its sq-N still, which doubles as the poster, so playback never jumps or crops.
- Rewarded ads: the server opens an ad view with a unique ymid passed to the Monetag SDK, and only the secret-checked Monetag postback (/api/public/monetag-postback) pays, once per ymid, valued events only, under row locks with a daily cap, because client reports of ad views can be forged.
- Screen headers use the shared ScreenHero/Logo components (src/components/dogg/hero.tsx) and the neon theme block at the end of src/styles.css, so all five screens keep one visual style.
- The shared game clock in the provider ticks once per second and fast-moving counters keep their own local timer, because a fast global tick re-renders every screen and makes phones lag; bundled images are resized WebP for the same reason.
- Referrals: the inviter comes only from the signed initData start_param (ref_<telegramId>) and attaches only to a brand-new account; a recruit qualifies (inviter bonus) on its first mining shift start inside dogg_shift, and the bonus plus the % of the recruit's mining claims accrue in a pending pot, all inside DB functions, because client-side referral data can be forged. Mining and referral claims never require a wallet; only withdrawals do.
- Withdrawal verification: withdrawals require a one-time, permanent per-account flag set only by the server after a fresh on-chain read of the linked wallet's $DOGG balance (threshold VERIFY_BUY in src/lib/purchase.ts, enforced in dogg_verify_withdraw); one wallet verifies a single account, and dogg_withdraw re-checks the flag, because client-reported balances can be forged.
- Admin: admins are Telegram ids in the dogg_admins table; every admin server function (src/lib/admin.functions.ts) re-verifies signed initData and membership, and admin changes are written to dogg_admin_log; the header shield and /admin page are only UX, the server is the boundary.
- Admin tasks: channel/group tasks are paid only after the bot's getChatMember sees the player inside (bot must be admin, checked when the task is saved); bot tasks pay 10 s after the server-recorded start; one claim per player per task enforced in dogg_task_claim. Shared Telegram server helpers live in src/lib/telegram.server.ts and are imported dynamically inside handlers.
- i18n: all UI text comes from src/lib/i18n (Spanish source dictionary; other languages are typed against its keys), stored history labels are dictionary keys, and server errors stay Spanish and are mapped client-side by translateServer, so DB functions and the client never drift apart.
- Bot chat: /start, /invite, /help are answered by /api/public/telegram-webhook (secret header derived from the bot token); the payouts job re-registers the webhook to the published URL. Notifications (withdrawal sent/returned, referral joined/qualified) go through src/lib/notify.server.ts and stamp a *_notified_at column with a conditional update first, so each is sent at most once; message texts live in src/lib/bot-messages.ts.
- Multi-account detector: the client sends a device id + traits hash on each open; the server HMACs them (plus the IP) into dogg_signals and scores accounts in DB functions (dogg_multi_score/report); it only informs admins (panel tab + one bot alert at risk 70) and never blocks, because the owner decides.
