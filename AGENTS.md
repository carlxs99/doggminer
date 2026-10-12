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
- Real hold = TONAPI jetton balance of a wallet proven via TON Connect ton_proof (server-signed payload, signature checked against on-chain public key) plus in-app balance; checked server-side on miner activation and on claim, because client-reported balances can't be trusted.
