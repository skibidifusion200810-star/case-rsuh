# CASE RUSH · CS.MONEY price + image integrity

## Problem fixed
The older importer used case price * 0.15 as a placeholder when no market quote was found. That accidentally produced **0.01 €** for high-value skins inside the free case. The new importer no longer manufactures that value.

All balances/values are **virtual euro amounts**, stored as integer cents, and cannot be exchanged for real euros.

## What can be verified automatically?
- Names, wears, case photos and weapon image URLs: ByMykel [CSGO-API](https://github.com/ByMykel/CSGO-API).
- Every image URL considered for **new draws** gets an HTTP HEAD check at seed time. Items with missing/unreadable images are skipped. Legacy inventory items receive repaired image references when available.
- Price provenance is recorded as `CSMONEY_TRADE` (exact matching listing quote), `BYMYKEL_USD_SNAPSHOT` (older **non-CS.MONEY** source), or `UNVERIFIED`.
- Every price is for an **exact wear**: e.g. `AWP | Dragon Lore (Factory New)` is different from `AWP | Dragon Lore (Field-Tested)`. Knife phases/patterns/float can have separate prices.
- Re-seeding locks values for existing owned inventory items in `valueAtDrop` before changing catalog valuations. Old item values are **not retroactively re-priced**.

## CS.MONEY price feed (server side only)

CS.MONEY Trade's website has no supported open/public bulk price API. The integration is via the **paid third-party** Skinstrack feed (not an official API), which represents CS.MONEY TRADE listing offers.

- Endpoint: `https://api.skinstrack.com/v2/paid/items?providers=csmoney_trade`
- Requirements: paid API access and a secret key in Render's **case-rush → Environment → SKINSTRACK_API_KEY**.
- Set optional `REQUIRE_CSMONEY_QUOTES=true` to **only** allow items that have a valid CS.MONEY Trade quote. Without API access this **will disable all new openings**, intentionally, rather than imply unverified values are CS.MONEY prices.
- The importer retrieves USD listing amounts, obtains a published USD/EUR rate from Frankfurter, matches exact `market_hash_name` with exterior/wear, and refuses 0/invalid/too-old quotes.
- Run the Render service **Manual Deploy → Deploy latest commit**. On boot the Dockerfile runs `npm run db:push && npm run db:seed`.
- Watch Render deploy logs for `[SKIN IMAGE MISSING]`, `[PRICE UNVERIFIED]`, `CS2 price/image audit:` and `CS.MONEY quote import disabled`.
- Do not paste the API key into ChatGPT or GitHub; enter it **only** as a Render secret environment variable.

The provider may lack a listing for some rare variants. Such a skin will be unavailable under strict mode, not assigned a made-up price. The user-supplied Dragon Lore reference of 9,179 € is not automatically assigned to an unspecified wear; it must be matched against the actual variant and timestamp.

## Images and copyright
ByMykel's code/database metadata and Valve/CS2 game skin images have different licenses/rights. Verify permission for public redistribution or production use of game art; external source URLs may break or be blocked.

## IMPORTANT: Price snapshots are NOT guaranteed actual market offers
CS.MONEY Trade and CS.MONEY Market are different price sources. Listing prices vary by wear, phase, float, availability and fees. A quote is a **virtual redemption reference only** for CASE RUSH and does not imply that the player owns the real CS2 item or has any cash redemption rights.

## Verify
In a live app, open `/api/health` and `/api/game?action=cases` to confirm the database responds and each displayed item has `imageUrl`, `marketHashName`, `priceOrigin`, `priceCheckedAt`, and a positive `value`. Image HEAD checks were performed at the last seed; runtime browsers can still block external images.
