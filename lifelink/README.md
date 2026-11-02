# LifeLink v1.3

**Connecting People. Reducing Delays. Supporting Lives.**

LifeLink is a healthcare coordination prototype for finding nearby blood banks, preparing donor appointment details for e-RaktKosh, creating OTP-verified user accounts, and saving organ-donation consultation enquiries.

## What's new in v1.3

- **Find nearby blood banks scrolls correctly:** the hero action switches to the search tab and waits for the search panel to render before smooth-scrolling.
- **Donor appointment preparation:** collect donor name, mobile, optional email, blood group, selected blood bank, preferred date and visiting hours. LifeLink copies the details to the clipboard and opens the official e-RaktKosh appointment page.
- **Organ donation consultation request:** collect name, contact, topic, preferred authorized institution and preferred date/time. Requests are saved to the local database with a reference code and `PENDING_REVIEW` status. This is an enquiry, not a confirmed hospital appointment.
- **Sign up / login with OTP:** choose mobile + SMS OTP or email + OTP. After successful verification, the account is saved in the database and receives a permanent LifeLink user ID. The session is held in a signed, HTTP-only cookie.
- **Persistent local database:** SQLite via Prisma for accounts, OTP challenges and organ consultation requests.
- Preserves the **top 10 nearest blood bank** search limit and existing OSM attribution.

## Run locally

Requirements: Node.js 20+ and npm.

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

For local development, the example enables a development OTP. The UI displays the development OTP after sending it (SMS development code is `123456`). This is only for local testing and must never be enabled in production.

Create the database and Prisma client:

```bash
npx prisma generate
npx prisma migrate dev --name init
```

Start the application:

```bash
npm run dev
```

Open http://localhost:3000.

## Configure real OTP delivery

### Email OTP

Set these values in `.env` using a verified sender/domain in Resend:

```env
RESEND_API_KEY="re_..."
RESEND_FROM="LifeLink <verify@your-verified-domain.com>"
```

### SMS OTP

Create a Twilio Verify service and configure:

```env
TWILIO_ACCOUNT_SID="AC..."
TWILIO_AUTH_TOKEN="..."
TWILIO_VERIFY_SERVICE_SID="VA..."
```

Set `LIFELINK_DEV_OTP="false"` after real delivery is configured. In production the development OTP mode is explicitly rejected.

Generate strong, separate secrets for production:

```bash
openssl rand -base64 48
```

Set the generated values as `SESSION_SECRET` and `OTP_HASH_SECRET`. Never commit `.env` or provider credentials to GitHub.

## e-RaktKosh appointment hand-off: important limitation

LifeLink gathers donor details and copies a formatted summary to the clipboard before opening the official e-RaktKosh donor appointment form. It does **not** claim to auto-fill that government website: the portal is on another domain and no supported public prefill/API contract has been integrated. The current public appointment form visibly asks for Blood Bank, Tentative Date, Visiting Hours and blood-group / ABHA-related fields; donor sign-up is a separate flow with mobile OTP and demographic details. Users may need to paste details, complete additional fields and verify directly on e-RaktKosh.

- [e-RaktKosh donor appointment form](https://eraktkosh.mohfw.gov.in/BLDAHIMS/bloodbank/onlineDonationRequest_epass.cnt)
- [e-RaktKosh donor sign-up](https://eraktkosh.mohfw.gov.in/BLDAHIMS/bloodbank/portalDonorSignup.cnt)
- [e-RaktKosh blood stock](https://eraktkosh.mohfw.gov.in/BLDAHIMS/bloodbank/stockAvailability.cnt)

A preferred date submitted through LifeLink is not a confirmed booking. The blood bank must confirm the appointment.

## Organ consultation request: important limitation

LifeLink stores an organ donation consultation enquiry and provides a reference code. It does not create an appointment in a hospital's scheduling system or guarantee that a transplant coordinator will contact the user. Connect an authorized institution / NOTTO workflow before describing this as a confirmed appointment. No donor-recipient matching, organ sales, medical compatibility decisions or allocation workflows are provided.

## Database and deployment

The included SQLite database is convenient for local development and stores records in `dev.db` at the project root. SQLite on an ephemeral/serverless host is not a production persistence solution. Before deploying publicly, change the Prisma datasource to PostgreSQL, configure a managed PostgreSQL `DATABASE_URL`, generate and run migrations, and use a persistent hosting environment. Add a verified organization contact and a shared rate limiter for OTP requests. Review privacy, consent, retention and Indian data-protection obligations before collecting real personal or health-related data.

## Blood bank search

- State, city and optional sector/locality search.
- OpenStreetMap Nominatim geocoding and Overpass discovery.
- 40 km radius, maximum 10 results, sorted nearest-first by straight-line distance.
- Mapped records are not proof of current operation, licensing or stock. Verify each centre before travelling.
- Configure `LIFELINK_OSM_USER_AGENT` with a real maintainer contact before deployment and follow the current Nominatim usage policy.

## Security notes

- OTP challenges expire after five minutes and allow at most five verification attempts.
- OTP sends are limited to three per destination in ten minutes (per application database).
- Sessions use a signed HTTP-only cookie with a 30-day lifetime.
- Use HTTPS in production; set strong independent secrets; configure provider-side abuse controls; add shared rate limiting / CAPTCHA before public launch.
- This is a portfolio MVP, not a clinical service or emergency-response service.
