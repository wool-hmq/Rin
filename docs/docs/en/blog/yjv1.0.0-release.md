---
pageType: doc
sidebar: false
---

# Secondary Edition yjv1.0.0: A Dedicated Version Line Starts

**Release Date**: October 24, 2026

Starting today, the Yangjiao Express secondary development edition ([wool-hmq/Rin](https://github.com/wool-hmq/Rin)) runs its own `yjvX.Y.Z` version line, maintained separately from the official upstream ([openRin/Rin](https://github.com/openRin/Rin)) `vX.Y.Z` line. The first release is `yjv1.0.0`, and follow-up lines continue as `yjv1.1`, `yjv1.2`, and so on.

## Version line conventions

- Secondary edition releases use the `yjv` prefix; the official upstream keeps the `v` prefix
- The `yjv` numbers stay independent from the `0.3.0` semantic versions in each package; release tags follow `yjvX.Y.Z`
- Official upstream history (`v0.3.0`, `v0.2.0`, ...) stays in the changelog and is labeled as official upstream
- Wherever both repositories appear, the docs list the **secondary development edition (this repository)** first, followed by the **official upstream openRin/Rin**

## Highlights of this release

### Friend links and verification

- Self-service friend links over email: applicants request, modify, or delete friend links by email, with a JSON template, an image captcha, a cancel command, and reply interception guidance
- Friend-link verification supports DNS TXT and HTML file uploads: the applicant replies `1` or `2` in the email, the DNS route validates the TXT record of the `_jiaofriend` host, and the file route keeps the strict 200 status plus `<body>` text match
- Friend-link groups and display ordering, scheduled availability checks, and `friends-sitemap.xml` output

### Account security

- TOTP two-factor authentication for every user, with recovery codes and login rate limiting, including accounts without a password
- API keys for external calls: admins create and revoke keys with scoped permissions from the settings page
- Login throttling and account lockout apply to the password / TOTP login path

### Content and reading experience

- Multiple comment systems, webhook notifications, RSS, sitemap with dynamic robots.txt
- AI summaries, AI-enhanced search, custom models, and a reorderable fallback model queue
- Shared monorepo packages (`@rin/api`, `@rin/ui`) with shared types across frontend and backend

### Deployment and engineering

- Deployment, development, and database tasks unified behind the Rin CLI, with Build / Deploy / Preview / Release / docs-site workflows on GitHub Actions
- A lighter backend runtime tailored for Cloudflare Workers, with routes and dependencies loaded on demand
- Chinese and English docs maintained side by side, with the deployment, configuration, and database guides calibrated against the current implementation

## Upgrade notes

- When upgrading from the official upstream to this edition, the deployment script applies the migrations in `server/sql/` automatically; no manual step is required
- Email login, email verification codes, and self-service friend links are optional and require `EMAIL_SEND_URLS` / `EMAIL_SEND_KEYS` — see [Environment Variables](../configuration/env)
- TOTP, API keys, and friend-link groups need no extra environment variables; enable them from the admin pages when needed

The full change list lives in the [changelog](../guide/changelog), and the deployment steps live in the [deployment guide](../guide/deploy).

## Feedback

If you find issues while validating `yjv-1.0.0`, report them through:

- 🐛 [Yangjiao Express Secondary Development Edition issues](https://github.com/wool-hmq/Rin/issues)
- 💬 [Yangjiao Express Secondary Development Edition discussions](https://github.com/wool-hmq/Rin/discussions)
- 📖 Official upstream issues: [openRin/Rin issues](https://github.com/openRin/Rin/issues)
- 💬 Official upstream discussions: [openRin/Rin discussions](https://github.com/openRin/Rin/discussions)
