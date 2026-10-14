# Email Friend Link Application

Rin supports applying, modifying, and removing friend links automatically via email, with no backend login needed — ideal for letting visitors self-service their friend links.

## How it works

Visitors email your dedicated address (e.g. `friend-request@your-domain.com`). Rin's Worker receives the mail through Cloudflare Email Routing and handles it automatically:

1. Visitor emails with body **友链申请** (or 友链修改 to modify, 友链删除 to delete).
2. Rin replies with a JSON template to fill in.
3. Visitor fills in the JSON and replies.
4. Rin generates an 8-character code (`a`) and, in the reply email, includes the verification HTML source; the visitor must create an `a.html` file at the root of their site and copy the source in **verbatim** (no additions or changes).
5. Visitor replies with body **请你进行下一步验证**.
6. Rin fetches `https://site-url/a.html`; the GET must return **200** and the page `<body>` must contain **exactly** the verification code (`a`) — only then does Rin treat domain ownership as verified and add/update/delete the friend link in the database.

### Operations and JSON templates

| Operation | Trigger body (must match exactly) | JSON fields |
| --- | --- | --- |
| Apply | `友链申请` | `name`, `url` (site URL), `avatar` (site icon URL), `desc` (site description) |
| Modify | `友链修改` | `oldUrl`, `newUrl`, `avatar`, `name`, `desc` |
| Delete | `友链删除` | `url` (site URL) |
| Cancel | `结束本次友链申请` | none (terminates the current application immediately) |

Notes:

- The reply body must contain **only** that JSON.
- Modifying requires two verifications, one code for the old site and one for the new site.
- Replying `结束本次友链申请` at any stage terminates the current application and frees the slot for others.
- The cancel hint only appears in emails sent **while an application is in flight**. Once it ends (success, invalid data, forced cancel, or timeout) that email carries no cancel hint.
- The receiving address differs from the outbound sending address, so hitting "Reply" in a mail client sends to the outbound address and the system never sees it. Every email that expects a reply ends with a reminder to compose a new email to the receiving address instead.
- Site URLs support redirect links: if a URL looks like `https://link.your-domain/?...&to=https://real-site&...`, the system extracts the real address from the `to` param for matching, so modify/delete works whether you provide the redirect link or the real URL.
- Outbound emails are sent by the MailPort sending service, sharing the existing `EMAIL_SEND_URLS` / `EMAIL_SEND_KEYS`.

## Prerequisites

1. Deploy [MailPort](https://github.com/wool-hmq/mailport) and set `EMAIL_SEND_URLS` / `EMAIL_SEND_KEYS` (see `env.md`).
2. Enable Cloudflare Email Routing and set the routing rule for your dedicated address (e.g. `friend-request@your-domain.com`) to **Send to a Worker**, selecting the worker running Rin.
3. The sender domain used by MailPort should not be the same as your receiving domain, to avoid Rin processing its own outgoing mail.

## Rules and limits

- **Concurrency = 1**: only one visitor application at a time. A concurrent applicant is told to retry in 20 minutes.
- **10-minute verification window**: a code is valid for 10 minutes from the moment it's issued; exceeding it auto-terminates the application.
- **30-minute total window**: an application must finish within 30 minutes of starting.
- **Invalid JSON or site URL**: Rin emails the visitor about the error and terminates the application.
- **Strict verification**: the GET must return 200 and the `<body>` must match the code exactly (whitespace differences allowed). SPA fallbacks, custom 404 pages (full-page HTML with 200), 403/500, and 30x redirects all fail and can be retried within the window.
- Email-completed friend links have `accepted` = `1`, with no backend review step. Their owner `uid` is resolved as described below.

## Optional toggle

- `friend_email_apply_enable` (database config, `server.config`): set `false` to disable; default `true`. Write it via the admin settings page or `serverConfig`.

## Owner UID (which account owns self-service friend links)

For friend links created via email, the owner `uid` is resolved as follows:

1. **Applicant email is bound to an account**: if the applicant's email matches a `users.email` row, the friend link is owned by that account's `uid`.
2. **No bound account**: otherwise it is owned by a dedicated self-service account, default `uid = 7`.

### How to customize

- **Option 1 (recommended, no code change)**: write `friend_email_owner_uid` in the admin settings or `serverConfig`, set to the desired account `uid` (e.g. `7`).
- **Option 2 (change the code default)**: edit the `DEFAULT_EMAIL_OWNER_UID` constant in `server/src/services/friend-email.ts` (default `7`).

> Note: in either case, make sure the target `uid` account exists, otherwise the insert fails on the foreign key constraint.

## Post-deploy verification

Send an email with body `友链申请` to `friend-request@your-domain.com`; you should receive a reply with the JSON template, confirming the whole pipeline works.