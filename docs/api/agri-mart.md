# Agri Mart (shop, cart, checkout, payments)

Catalogue of seeds, fertilisers, pesticides and equipment; a server-side cart; orders paid online. Auth
required everywhere except the payment webhook (server-to-server).

**Payments: Razorpay.** One integration gives UPI (the farmer picks PhonePe, Google Pay, Paytm, BHIM or any UPI
app on their phone), plus cards, netbanking and wallets. Razorpay's React Native SDK (`react-native-razorpay`)
needs a native module, so it requires an Expo **development build** / prebuild, not Expo Go.
**Cash on delivery** is supported when the server enables it (`COD_ENABLED`), for orders up to
`COD_MAX_ORDER_RUPEES` (default ₹5000) — see "Cash on delivery" below.

**Money:** every amount is in **rupees** as a JSON number (e.g. `420.0`), except `payment.amount_paise`, which is
the integer paise value Razorpay wants. Prices include GST. Delivery is free for now (no delivery charge
field yet).

## Catalogue

### GET /shop/categories
**200** `[ { "code": "seeds", "name": "విత్తనాలు" }, … ]` — codes: `seeds` `fertilizers` `pesticides` `equipment`.

### GET /shop/products
| Query | |
|---|---|
| `category` | category code |
| `crop` | products for this crop code (plus general products for any crop) |
| `q` | search in product name (any language) and brand |
| `deals` | `true` → only discounted products, biggest discount first |
| `limit` / `offset` | paging, `limit` 1–100 (default 50) |

**200** — array of Product:
```json
{
  "id": 3,
  "sku": "NEEM-1L",
  "category": { "code": "pesticides", "name": "పురుగుమందులు" },
  "name": "వేప నూనె 1500 ppm — 1 లీ",
  "description": "…",
  "brand": "…",
  "pack_size": "1 L",
  "price": 420.0,
  "mrp": 520.0,
  "discount_pct": 19,
  "in_stock": true,
  "stock": 3,
  "image_urls": ["https://…"],
  "crop_codes": []
}
```
`discount_pct` is whole percent off MRP (0 = none) — use it for deal badges. `stock` lets you show "only 3 left".
`crop_codes: []` means it's for any crop. Names and descriptions come back in the farmer's language (English
fallback).

### GET /shop/products/{id}
**200** — one Product. Inactive products → `404 product_not_found`.

## Cart

The cart lives on the server (survives reinstall, shared across devices). Every cart call returns the whole Cart:

```json
{
  "items": [ { "product": { "…": "Product" }, "quantity": 2, "line_total": 840.0, "available": true } ],
  "item_count": 2,
  "total": 840.0,
  "mrp_total": 1040.0,
  "savings": 200.0
}
```
`available: false` means the product was deactivated or has less stock than the quantity. Checkout will
fail until the farmer lowers the quantity or removes it.

| Endpoint | Body | |
|---|---|---|
| `GET /cart` | | |
| `PUT /cart/items/{product_id}` | `{ "quantity": 2 }` | Sets the quantity (not adds). `0` removes. Max 100. |
| `DELETE /cart/items/{product_id}` | | Removes the item |

Errors: `404 product_not_found`; `409 insufficient_stock` with `details: { "available": 3 }`.

## Checkout flow

```
1. POST /orders  { address }            → order (status pending_payment) + payment info. Stock is reserved,
                                          cart is emptied.
2. Open Razorpay Checkout with payment.key_id, payment.provider_order_id, payment.amount_paise
   (prefill the farmer's phone; set method to UPI first).
3a. Success → POST /orders/{id}/payment/verify with the 3 values Razorpay returns → status paid.
3b. Farmer backs out → they can retry payment for the same order until pay_by, or POST /orders/{id}/cancel.
```

If the app is killed between 2 and 3a, Razorpay's webhook still marks the order paid. Refresh with
`GET /orders/{id}`. Unpaid orders are cancelled automatically after **30 minutes** (`pay_by`) and their stock
is released.

### POST /orders
```json
{
  "address": {
    "name": "Ramesh",
    "phone": "9876543210",
    "line1": "H.No 4-12, Main road",
    "village": "Kolakaluru",
    "mandal": "Tenali",
    "district": "Guntur",
    "state": "AP",
    "pincode": "522301"
  }
}
```
`village` and `mandal` are optional. `state` is `AP` or `TG`. `pincode` is 6 digits.
Add `"payment_method": "cod"` for cash on delivery (default `"online"`).

**201** — Order:
```json
{
  "id": 17,
  "status": "pending_payment",
  "items": [ { "product_id": 3, "name": "…", "pack_size": "1 L", "unit_price": 420.0, "quantity": 2, "line_total": 840.0 } ],
  "total": 840.0,
  "mrp_total": 1040.0,
  "savings": 200.0,
  "delivery_address": { "…": "as sent, phone normalised to +91…" },
  "payment": {
    "provider": "razorpay",
    "key_id": "rzp_live_…",
    "provider_order_id": "order_N5…",
    "amount_paise": 84000,
    "currency": "INR"
  },
  "pay_by": "2026-10-16T11:30:00Z",
  "paid_at": null,
  "created_at": "2026-10-16T11:00:00Z"
}
```
Order items are a snapshot: later price or name changes don't affect past orders. `payment` and `pay_by` are
only present while `pending_payment`.

| Status | code | When |
|---|---|---|
| 409 | `insufficient_stock` | `details`: `[ { "product_id": 3, "available": 1 } ]`. Nothing is reserved, cart is kept. |
| 422 | `cart_empty` | |
| 422 | `validation_error` | Bad address |
| 503 | `payment_unavailable` / `payment_not_configured` | Gateway down / not set up. No order created, cart kept. |

### POST /orders/{id}/payment/verify
```json
{ "razorpay_order_id": "order_N5…", "razorpay_payment_id": "pay_N5…", "razorpay_signature": "…" }
```
**200** — Order with `status: "paid"`. Safe to call twice. `400 payment_verification_failed` if the signature
doesn't match (don't show "paid"; refresh the order — the webhook may still confirm it).

### POST /orders/{id}/cancel
Only for `pending_payment`. **200** — Order with `status: "cancelled"`, stock released.
`409 order_not_cancellable` otherwise (paid orders need support/refund — not built yet).

### GET /orders · GET /orders/{id}
Order history for the Profile screen, newest first. `404 order_not_found` for other farmers' orders.

### Order statuses
| `status` | Meaning |
|---|---|
| `pending_payment` | Waiting for payment; stock reserved until `pay_by` |
| `confirmed` | Cash-on-delivery order placed; stock reserved; awaiting dispatch (no expiry) |
| `paid` | Paid; awaiting dispatch |
| `shipped`, `delivered` | Set by ops staff ([admin.md](admin.md)) |
| `cancelled` | Cancelled by farmer or expired unpaid |
| `refund_pending` | Will be refunded: paid after expiry with stock gone, or cancelled by ops after payment |
| `refunded` | Refund done |

## Cash on delivery

`POST /orders` with `"payment_method": "cod"`:

- **201** — Order with `status: "confirmed"`, `payment_method: "cod"`, `payment: null`, `pay_by: null`. No
  Razorpay step: show "Order placed — pay ₹X on delivery". Stock is reserved and the cart is emptied.
- The farmer can `POST /orders/{id}/cancel` until it ships (stock is released).
- Ops moves it `shipped` → `delivered`; `paid_at` is set at delivery (cash collected).
- Every Order now has `payment_method`: `"online"` or `"cod"`.

| Status | code | When |
|---|---|---|
| 422 | `cod_not_available` | COD switched off on this server |
| 422 | `cod_limit_exceeded` | Total over the limit — `details: { "max_order": 5000 }`; offer online payment |

COD works even on servers without Razorpay keys; online orders there fail with `503 payment_not_configured`.

## Dev mode (no real money)

With `PAYMENT_PROVIDER=fake` (default in development), `payment.provider` is `"fake"`. Skip Razorpay Checkout
and call `POST /orders/{id}/payment/dev-complete` (no body) to mark the order paid. That endpoint returns `404` on
servers using real Razorpay.

## Webhook (server-to-server, not for the app)

`POST /payments/razorpay/webhook`. Configure in the Razorpay dashboard for events `payment.captured` and
`order.paid`, with the secret in `RAZORPAY_WEBHOOK_SECRET`. **Enable auto-capture** in Razorpay payment settings,
or payments stay "authorized" and never trigger `payment.captured`.
