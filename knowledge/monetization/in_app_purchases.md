# In-App Purchases & Web Microtransactions

## Web Gaming Economics

On Yandex Games, VK, OK and CrazyGames:
- Primary revenue is ads (rewarded + interstitial).
- IAP adds roughly 15–30 % on top, concentrated in a small number of payers.

## Top IAP SKUs

1. **Ad-Free / VIP Pass** — removes interstitials and banners forever, plus a
   passive bonus and a cosmetic. Highest-converting SKU in almost every game.
2. **Meta-currency bundles** — small / medium / large, for faster unlocks.
3. **Exclusive character or class unlocks** with a signature ability.

## Config

Products are declared in `public/playgama-bridge-config.json`:

```json
{
  "payments": [
    { "id": "premium_status", "playgama": { "amount": 49 } },
    { "id": "coins_small",    "playgama": { "amount": 10 }, "vk": 123456 }
  ]
}
```

- `id` is what the game code passes to `purchase(id)`.
- `"playgama": { "amount": N }` — price in Gam. **Required** to publish on Playgama.
- **VK always needs an override**: VK uses numeric item IDs from its own store.
- **Playdeck always needs** `amount` (Telegram Stars) + `description`.
- Yandex: overrides only if you registered a different ID. Unlike leaderboard IDs,
  product IDs **may** contain underscores.
- Prices on Yandex/VK are set in the developer console, not in this file.

## The three purchase bugs that ship

### 1. `consumePurchase` takes the product id, not the purchase token

```typescript
await bridge.payments.consumePurchase(result.purchaseToken);  // WRONG — always rejects
await bridge.payments.consumePurchase(item.id);               // RIGHT
```

The vendor bridge resolves consumables by `id`; a token never matches, so every
consume was rejected and consumables piled up unconsumed on the platform side.

### 2. Never consume without granting

A startup routine that calls `getPurchases()` and consumes what it finds
**destroys paid goods**: if the player paid but the grant did not complete
(network drop, closed tab), the next launch silently eats the purchase — money
taken, nothing delivered.

The contract is the opposite: check for unprocessed purchases **every launch**,
grant them, then consume.

```typescript
export async function redeemPendingPurchases() {
    if (!bridge.payments?.isSupported) return;
    let purchases = [];
    try { purchases = await bridge.payments.getPurchases(); } catch { return; }

    for (const p of purchases) {
        const id = typeof p === 'string' ? p : p.id;
        applyPurchase(id);                                  // grant FIRST
        if (CONSUMABLE_PRODUCT_IDS.has(id)) {
            try { await bridge.payments.consumePurchase(id); } catch {}
        }
    }
    SaveService.saveImmediate();
}
```

Keep `CONSUMABLE_PRODUCT_IDS` as a **single exported constant**. A shipped game
had three divergent copies of that list, and the startup pass was missing three
products the shop sold.

### 3. Never hardcode prices

Currency and amount differ per platform. Pull the catalog asynchronously (do not
block boot), cache it, and show a fallback until it lands.

```typescript
const priceMap: Record<string, string> = {};
bridge.payments.getCatalog().then((items) => {
    items.forEach((i) => { priceMap[i.id] = i.price || `${i.priceValue} ${i.priceCurrencyCode}`; });
    rebuildShopUI();
});
```

> Vendor fragility: the Yandex bridge builds catalog entries with
> `catalog.find(x => x.id === e.id).title` and no undefined check. If one product
> is missing from the console, **the whole catalog call throws** and every price
> in the shop disappears. Do not patch the vendor file — it is overwritten on
> update; keep the console list in sync with the config instead.

## Guest players

A purchase attempt from a guest should route through the sign-in modal with the
intent stored (`pendingPurchaseAction`) and replayed after auth. Never grant the
item for free because payments are unavailable.

## Platforms without payments

`bridge.payments.isSupported === false` means the shop must not show locked paid
content. Treat paid-by-design items as free/unlocked, without price tags or
padlocks — see `../ux/ui_design_system.md`, capability gating.

CrazyGames routes payments through Xsolla and needs `xsollaProjectId` in the
config plus a per-product `platformProductId`; without it `isSupported` is false
by design.

## Architecture

Wrap everything in a `PaymentService` returning explicit results rather than
throwing at call sites:

```typescript
async purchase(id: string): Promise<{ ok: boolean; purchase?: unknown; error?: unknown }> {
    if (!bridge.payments?.isSupported) return { ok: false, error: 'unsupported' };
    try { return { ok: true, purchase: await bridge.payments.purchase(id) }; }
    catch (error) { return { ok: false, error }; }
}
```

Reconcile ownership (`getPurchases()`) at every startup — that is also how the
"no ads" flag is restored on a new device.
