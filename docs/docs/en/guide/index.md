# Introduction

Rin is a blog based on Cloudflare Pages + Workers + D1 + R2. It does not require a server to deploy. It can be deployed just with a domain name that resolves to Cloudflare.

## Demo

[xeu.life](https://xeu.life)

## Features
1. Support GitHub OAuth login. By default, the first logged-in user has management privileges, and other users are ordinary users
2. Support Gitee OAuth login
3. Support QQ login (Xinyue)
4. Support WeChat login (聚合登录 / Mapay)
5. Support email verification code login
6. Support username/password login
7. Support article writing and editing
8. Support local real-time saving of modifications/edits to any article without interfering between multiple articles
9. Support setting it as visible only to yourself, which can serve as a draft box for cloud synchronization or record more private content
10. Support dragging/pasting uploaded images to a bucket that supports the S3 protocol and generating links
11. Support setting article aliases, and access articles through links such as https://xeu.life/about
12. Support articles not being listed in the homepage list
13. Support adding links of friends' blog, and the backend regularly checks and updates the accessible status of links every 20 minutes
14. Support replying to comment articles/deleting comments
15. Support sending comment notifications through Webhook
16. Support automatic identification of the first picture in the article and display it as the header image in the article list
17. Support inputting tag texts such as "#Blog #Cloudflare" and automatically parsing them into tags
18. For more features, please refer to https://xeu.life
