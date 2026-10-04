# Email Friend Link Application

Rin supports applying, modifying, and removing friend links automatically via email, with no backend login needed — ideal for letting visitors self-service their friend links.

## How it works

Visitors email your dedicated address (e.g. `friend-request@your-domain.com`). Rin's Worker receives the mail through Cloudflare Email Routing and handles it automatically:

1. Visitor emails with body **友链申请** (or 友链修改 to modify, 友链删除 to delete).
2. Rin replies with a JSON template to fill in.
3. Visitor fills in the JSON and replies.
4. Rin generates an 8-character code (`a`) and asks the visitor to create an `a.html` file at the root of their site.
5. Visitor replies with body **请你进行下一步验证**.
6. Rin fetches `https://site-url/a.html`; anything other than 404 proves domain ownership, and then Rin adds/updates/deletes the friend link directly in the database.

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
- Every system email ends with the cancel hint so applicants can abort at any time.
- Outbound emails are sent by the Rin-Email service on Vercel, sharing the existing `EMAIL_RESEND_URL` / `EMAIL_RESEND_PASS`.

## Prerequisites

1. Deploy Rin-Email to Vercel and set `EMAIL_RESEND_URL` / `EMAIL_RESEND_PASS` (see `env.md`).
2. Enable Cloudflare Email Routing and set the routing rule for your dedicated address (e.g. `friend-request@your-domain.com`) to **Send to a Worker**, selecting the worker running Rin.
3. The sender domain used by Rin-Email should not be the same as your receiving domain, to avoid Rin processing its own outgoing mail.

## Rules and limits

- **Concurrency = 1**: only one visitor application at a time. A concurrent applicant is told to retry in 20 minutes.
- **10-minute verification window**: a code is valid for 10 minutes from the moment it's issued; exceeding it auto-terminates the application.
- **30-minute total window**: an application must finish within 30 minutes of starting.
- **Invalid JSON or site URL**: Rin emails the visitor about the error and terminates the application.
- Verification accepts any response other than 404 (200, 30x, etc.); network errors/timeouts count as not passed and can be retried within the window.
- Email-completed friend links use `uid` = admin and `accepted` = `1`, with no backend review step.

## Optional toggle

- `friend_email_apply_enable` (database config, `server.config`): set `false` to disable; default `true`. Write it via the admin settings page or `serverConfig`.

## Post-deploy verification

Send an email with body `友链申请` to `friend-request@your-domain.com`; you should receive a reply with the JSON template, confirming the whole pipeline works.