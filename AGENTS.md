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
- Withdrawals: DB function deducts balance and queues atomically; server sends jetton transfers from the PAYOUT_MNEMONIC hot wallet under a single DB lock (seqno safety) and refunds on send failure; unconfirmed sends stay 'sending' for manual review rather than auto-refunding.
- Miner tier art is square: each sq-tier-N clip starts and ends on its sq-N still, which doubles as the poster, so playback never jumps or crops.
- Rewarded ads: the server opens an ad view with a unique ymid passed to the Monetag SDK, and only the secret-checked Monetag postback (/api/public/monetag-postback) pays, once per ymid, valued events only, under row locks with a daily cap, because client reports of ad views can be forged.
- Screen headers use the shared ScreenHero/Logo components (src/components/dogg/hero.tsx) and the neon theme block at the end of src/styles.css, so all five screens keep one visual style.
