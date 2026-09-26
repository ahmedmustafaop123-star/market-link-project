# MarketLink Agri-Hub Pakistan — Final Function Audit

**Date:** 26 September 2026 · **Server:** production build (`npm run build && npm start`) · **Result: 123 / 123 checks passed (0 failed).**

Reproduce it yourself at any time (server running):

```bash
node scripts/smoke-test.mjs                 # local
node scripts/smoke-test.mjs http://localhost:4000
SMOKE_HOST=your-domain.example node scripts/smoke-test.mjs    # behind a proxy/tunnel
```

The script creates its own throw-away account, listings, bids and orders, so it is safe to run repeatedly and never changes the demo passwords.

## What is covered

| Area | Checks | Result |
|---|---|---|
| Public catalogue & mandi rates (`/api/crops`, filters, search, `/api/mandi-rates`, `/api/tracking/:no`) | 5 | ✅ |
| Registration + email OTP verification (duplicate email, invalid phone, wrong OTP) | 7 | ✅ |
| Login / logout / session (`/api/auth/me`, wrong password, 401/403 handling) | 6 | ✅ |
| Role-based access control (farmer / buyer / inspector / admin isolation) | 6 | ✅ |
| Crop listings: create, edit, “my listings”, public detail | 4 | ✅ |
| Bidding: place bid, farmer counter-offer, buyer accepts → order created | 5 | ✅ |
| Escrow: wallet top-up via the test gateway, escrow lock, balance movement | 6 | ✅ |
| Delivery pipeline: inspection → dispatch → in-transit → checkpoint → delivery, automatic escrow release to the farmer (1.5 % fee) | 8 | ✅ |
| Wallet ledger, farmer payouts (request, minimum amount rule, admin payout) | 7 | ✅ |
| Reviews: create after delivery, duplicate blocked, farmer reply | 4 | ✅ |
| Disputes: raise, freeze progression, investigate, refund, money back in the ledger | 8 | ✅ |
| Admin console: users, create inspector, verify, password reset, analytics, reports, mandi rates, DB schema explorer, SQL console (dangerous SQL blocked) | 12 | ✅ |
| Quality inspections: list, file report, download report file | 3 | ✅ |
| Notifications (list, unread count, mark-all-read) | 2 | ✅ |
| Account: profile update, password change, weak password rejected | 5 | ✅ |
| Password reset: link issued, validated, single-use, login with new password, no account enumeration | 6 | ✅ |
| AI assistant (bilingual, rule-based fallback without API key) | 1 | ✅ |
| All 27 pages render (guest, buyer, farmer, inspector, admin) + redirect guards | 29 | ✅ |
| Escrow payment redirect resolves to the public https origin (ERR_ADDRESS_INVALID regression) | 1 | ✅ |

## Escrow redirect regression (original bug)

`node scripts/verify-payment-redirect.cjs --host=<your-domain> --full`

```
✅ redirect URL is an absolute https URL: https://<public-host>/pay/sandbox/MLT…
✅ redirect host is not a bind address (0.0.0.0 / :: / *)
✅ checkout page opens and shows the reference
✅ signed gateway callback settled the payment
✅ wallet credited Rs. 250,000
```

The same script fails against the previous commit (`http://0.0.0.0:3000/pay/sandbox/…`), which is the exact `ERR_ADDRESS_INVALID` case that was reported.

## Notes / known behaviour

* Money is only credited by a **verified gateway callback** (sandbox callback is HMAC-signed server-side); nothing is credited from the browser.
* Without `RESEND_API_KEY`, e-mails are written to the server log (outbox) — password-reset links are also shown on screen while `AUTH_DEV_LINKS` is not `false`.
* Forgot-password is rate-limited to **8 requests / 10 minutes per IP** (returns 429), so a burst of automated runs can skip that section — restart the server for a clean run.
* `PAYMENTS_SANDBOX=false` disables the built-in test gateway in production.
* The audit tool counts 123 checks; the earlier development run reported 124 because two alternative assertions were later merged.
