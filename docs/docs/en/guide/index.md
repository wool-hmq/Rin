# Introduction

Rin (Yangjiao Express secondary development edition) is a blog based on Cloudflare Workers + D1 + R2. A single Worker serves both the static frontend assets and the API. It does not require a server to deploy. It can be deployed with just a domain name that resolves to Cloudflare. This edition is built on the official upstream openRin/Rin and adds self-service friend links over email, TOTP, and API keys.

## Demo

[jiaoblog.dpdns.org](https://jiaoblog.dpdns.org)

## Features

### Accounts and security

1. Support GitHub OAuth login. By default, the first logged-in user has management privileges, and other users are ordinary users
2. Support Gitee OAuth login
3. Support QQ login (Xinyue)
4. Support WeChat login (聚合登录 / Mapay)
5. Support email verification code login
6. Support username/password login
7. Support TOTP two-factor authentication for every user, with recovery codes
8. Rate-limit failed logins to slow down credential stuffing

### Content and interaction

9. Support article writing and editing
10. Support local real-time saving of modifications/edits to any article without interfering between multiple articles
11. Support setting it as visible only to yourself, which can serve as a draft box for cloud synchronization or record more private content
12. Support dragging/pasting uploaded images to a bucket that supports the S3 protocol and generating links
13. Support setting article aliases, and access articles through links such as https://jiaoblog.dpdns.org/about
14. Support articles not being listed in the homepage list
15. Support replying to comment articles/deleting comments
16. Support sending comment notifications through Webhook
17. Support automatic identification of the first picture in the article and display it as the header image in the article list
18. Support inputting tag texts such as "#Blog #Cloudflare" and having them automatically parsed and displayed

### Friend links

19. Support adding links of friends' blog, and the backend regularly checks and updates the accessible status of links every 20 minutes
20. Support self-service friend-link application, modification, and deletion over email, with a captcha and domain ownership verification
21. Domain ownership verification supports both DNS TXT records and uploaded HTML files
22. Support friend-link groups and display order management

### Integrations and extensibility

23. Support issuing API keys for external calls with scoped permissions
24. Support AI summaries and AI-enhanced search, with custom models and a configurable fallback model order
25. Support RSS output and sitemaps (including a friend-link sitemap)
26. For more features, please refer to https://jiaoblog.dpdns.org
