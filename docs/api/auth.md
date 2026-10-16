# Auth — phone + OTP

No passwords, no email. A farmer logs in with their mobile number and a 6-digit SMS code. The first successful
verify creates their account.

## Flow

1. `POST /auth/otp/request` with the phone number → SMS is sent.
2. `POST /auth/otp/verify` with phone + code → access token, refresh token, farmer profile.
3. If `is_new_user` is true (or `farmer.profile_complete` is false), route to onboarding; else Home.
4. Send `Authorization: Bearer <access_token>` on API calls.
5. On `401 invalid_token`, call `POST /auth/refresh` once, retry the request. If refresh also fails, send the
   farmer back to login.

Store the refresh token in secure storage (`expo-secure-store`). Access tokens last 60 min; refresh tokens 60 days
and rotate on every use — **always save the new refresh token** from `/auth/refresh`.

**Dev note:** locally the server doesn't send SMS; the OTP is printed in the backend log (`DEV OTP for +91…: 123456`).

**Closed-beta test numbers:** on non-production servers, numbers listed in `OTP_TEST_NUMBERS` log in with the
fixed code in `OTP_TEST_CODE` (must be 6 digits) and no SMS is sent. Same API, same rate limits — the app needs
no changes. Production servers refuse to start with test numbers configured.

---

## POST /auth/otp/request

```json
{ "phone": "98765 43210" }
```

Accepts 10-digit Indian mobiles with or without `+91`, `91`, leading `0`, spaces or dashes. Normalised to `+919876543210`.

**200**
```json
{ "phone": "+919876543210", "expires_in": 300, "resend_after": 30 }
```
`expires_in` / `resend_after` are seconds — use them for the countdown and the "Resend" button.

| Status | code | When |
|---|---|---|
| 422 | `validation_error` | Not a valid Indian mobile number |
| 429 | `otp_cooldown` | Asked again within `resend_after` seconds |
| 429 | `otp_rate_limited` | More than 5 requests for this number in an hour |

## POST /auth/otp/verify

```json
{ "phone": "9876543210", "code": "482913" }
```

**200**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "Xk2...",
  "token_type": "bearer",
  "expires_in": 3600,
  "is_new_user": true,
  "farmer": { "...": "see farmers.md → Farmer object" }
}
```

| Status | code | When |
|---|---|---|
| 400 | `otp_invalid` | Wrong code (farmer can retry) |
| 400 | `otp_attempts_exceeded` | 5 wrong tries — must request a new OTP |
| 400 | `otp_expired` | Code expired, already used, or never requested — must request a new OTP |
| 422 | `validation_error` | Code isn't 6 digits / bad phone |

## POST /auth/refresh

```json
{ "refresh_token": "Xk2..." }
```

**200** — `{ "access_token", "refresh_token", "token_type", "expires_in" }`. The old refresh token stops working.

| Status | code | When |
|---|---|---|
| 401 | `invalid_refresh_token` | Expired, revoked or already used → back to login |

## POST /auth/logout

```json
{ "refresh_token": "Xk2..." }
```

**204**, no body. Revokes that refresh token. Always succeeds; delete local tokens either way.
