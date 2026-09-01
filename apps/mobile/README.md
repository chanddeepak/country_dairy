# Mobile app — parked

**This app is not shipping and is not maintained.** It is kept in the
repository as a starting point, not as working software. Do not build or
publish it without doing the work listed below first.

Last substantive change: **18 August 2026** — before the Cashfree checkout,
before phone sign-in replaced email sign-in, and before the Shiprocket
integration was removed. The storefront and API have moved a long way since.

## What is broken as it stands

| | |
| --- | --- |
| **Sign-in does not work** | `AuthContext` posts to `/auth/email/login`, which is behind `ENABLE_EMAIL_LOGIN` and switched off. Customers sign in with a mobile number and a one-time code now, and this app has no such screen. |
| **Wrong WhatsApp number** | It carries `918291939317`. The storefront and the footer both use `919997801112`. One of the two is wrong, and a customer messaging the wrong number gets no reply. |
| **No cart, no checkout** | `ENABLE_CART` and `ENABLE_WEBSITE_PAYMENT` are both false. Nothing can be bought. |
| **Untested against the current API** | Its assumptions predate two months of changes. Anything here that appears to work should be treated as unverified. |

## If it is picked up again

1. Replace email sign-in with the phone + one-time code flow the storefront
   uses, including its rate limits.
2. Correct the WhatsApp number, and read it from the API rather than a
   constant so it cannot drift again.
3. Decide what checkout means on a phone. The web flow hands off to Cashfree's
   own window, which is a browser experience — a native app needs their SDK or
   a web view, and that is a design decision, not a port.
4. Re-check every endpoint it calls against the current API. Several routes it
   was written for no longer exist.

## If it is not

Delete it. Sixteen components that look like working software but are not is a
trap for whoever reads this repository next — which is the reason this file
exists rather than the Expo boilerplate that was here before.

## Running it anyway

```bash
npm install
npx expo start
```

It will build. It will not sign anyone in.
