# Changelog

> **Versioning**: The Yangjiao Express secondary development edition uses its own `yjvX.Y.Z` line, starting at **yjv1.0.0**, to stay distinct from the official upstream openRin/Rin `vX.Y.Z` line. The `v0.3.0` / `v0.2.0` entries below are the official upstream history.

## yjv1.0.0 - October 24, 2026

The first release of the secondary development edition's own version line. It summarizes the features, fixes, and documentation changes landed in this repository since the fork.

### In this release

- **Friend-link verification now supports DNS TXT and HTML file uploads**
  - After the JSON payload is accepted, the state machine enters `awaiting_method_choice` and asks the applicant to pick a method: reply `1` (also `一` / `方案一` / `方法一`) for a DNS TXT record, or `2` (also `二` / `方案二` / `方法二`) for an HTML file
  - DNS: the instruction email lists host `_jiaofriend`, type `TXT`, value = verification code; verification queries the TXT records of `_jiaofriend.<visitor-domain>` through Cloudflare DNS-over-HTTPS and checks whether one contains the code
  - File: the existing strict check stays — the GET must return 200 and the `<body>` text (after stripping tags/scripts/styles) must contain the code
  - The state machine gains an `awaiting_verification` stage and records `verifyMethod`; a modify application asks for the method again for the old site and for the new site; pre-upgrade `verifying` states fall back to file verification

### New features

- **Self-service friend links over email**: applicants request, modify, or delete friend links by email, with a JSON template, an image captcha, a cancel command, reply interception with "compose a new email" guidance, and owner UID resolution by bound email
- **Friend-link groups and ordering**: manage groups and display order from the admin panel
- **TOTP two-factor authentication**: available to every user, with recovery codes and login rate limiting
- **API keys for external calls**: admins create and revoke keys with scoped permissions from the settings page
- **friends-sitemap.xml**: lists approved friend links with names and descriptions
- **MailPort multi-sender support**: ordered polling across several sender endpoints with legacy fallback
- **AI capabilities**: AI summaries, AI-enhanced search, custom models, and a reorderable fallback model queue
- **Content and reading experience**: multiple comment systems, webhook notifications, RSS, sitemap with dynamic robots.txt, and scheduled friend-link availability checks

### Fixes

- Fixed accounts without a password being unable to log in after enabling TOTP
- Fixed duplicated "not found" text and empty permission scopes on API key endpoints
- Fixed viewing a key turning encrypted storage into plaintext storage
- Fixed repeated captcha initialization crashing friend-link applications
- Fixed inbound email parsing under CJS / ESM bundles
- Fixed the 10214 race failure when uploading deployment secrets in bulk
- Fixed friend-link verification accepting SPA fallbacks, custom 404 pages, 403/500 responses, and 30x redirects
- Fixed the `awaiting_json` stage terminating an application when the body was not a JSON attempt
- Fixed `/friends-sitemap.xml` being swallowed by the frontend SPA

### Architecture and deployment

- Backend runtime moved to a lightweight framework tailored for Cloudflare Workers, with on-demand route and dependency loading
- Extracted shared packages such as `@rin/api` and `@rin/ui` for shared types and components
- Deployment, development, and database tasks unified behind the Rin CLI, with Build / Deploy / Preview / Release / docs-site workflows on GitHub Actions
- Synced upstream improvements: feed service repository layer, route guards, sitemap service, Modal component, image fallback component, and stable table-of-contents rendering

### Documentation

- Rewrote the deployment guide against the current implementation: repository order, site variables, workflow inventory, migration script paths, and deployment URL notes
- Wherever both repositories appear, the **secondary development edition (this repository)** is listed first and labeled, followed by the **official upstream openRin/Rin**
- Documentation directory restructure: `env.md` and `database.md` moved into `configuration/`
- Chinese and English docs updated together

### Upgrade notes

- When upgrading from the official upstream to this edition, the deployment script applies the migrations in `server/sql/` automatically; no manual step is required
- Email login, email verification codes, and self-service friend links are optional and require `EMAIL_SEND_URLS` / `EMAIL_SEND_KEYS` (see [Environment Variables](../configuration/env))
- TOTP, API keys, and friend-link groups need no extra environment variables; enable them from the admin pages when needed

## Official upstream history

### v0.3.0 - February 4, 2025

#### Architecture Refactoring

- **Lightweight Framework**: Refactored ElysiaJS backend framework to a lightweight custom framework, specifically optimized for Cloudflare Workers
  - Removed approximately 15 heavyweight dependencies, core framework code < 10KB
  - Implemented on-demand loading architecture, only initializing necessary services per request
  - Optimized startup time and memory footprint

#### New Features

- **Caching System**: Implemented a flexible caching system supporting both database and S3
  - Added `CACHE_STORAGE_MODE` environment variable, supporting `database` or `s3` mode
  - Supports automatic serialization and deserialization of cache data
  - Added cache table for high-frequency data storage

- **HyperLogLog Statistics**: Migrated PV/UV statistics to HyperLogLog algorithm
  - Uses 16384 registers with ~0.81% error rate
  - Added `visit_stats` table with pv counter and hll_data
  - Optimized feed visit tracking from O(n) query to O(1) lookup
  - Significantly reduced query time for high-traffic articles

- **Error Handling System**: Implemented comprehensive error handling mechanism
  - Added structured error classes (ValidationError, NotFoundError, etc.)
  - Implemented `GlobalErrorBoundary` for capturing React rendering errors
  - Added `useError` hooks for handling asynchronous operations and API calls
  - Server-side middleware for logging errors and generating request IDs

- **Cookie Authentication**: Migrated from Authorization Header to Cookie-based authentication
  - Backend sets HttpOnly, Secure, SameSite=lax cookies
  - Frontend removes Authorization Header, relies on browser cookies
  - Enhanced CSRF protection

#### Improvements and Optimizations

- **API Client Refactoring**: Replaced Elysia/Eden with custom API client
  - Removed @elysiajs/eden and rin-server dependencies
  - Created type-safe API client
  - Simplified API call pattern (from treaty pattern to direct method calls)
  - **BREAKING CHANGE**: Client API interface changed, e.g., `client.feed.index.get()` → `client.feed.list()`

- **Custom OAuth Implementation**: Replaced elysia-oauth2 with custom OAuth2 implementation
  - Generic OAuth2 plugin architecture supporting any OAuth2 provider
  - Built-in GitHub OAuth provider as default
  - CSRF protection via state parameter validation
  - Full TypeScript type support

- **Dependency Injection Refactoring**: Replaced typedi with native mechanisms
  - Removed typedi dependency injection container
  - Uses Elysia's decorate() and derive() for dependency injection
  - Services access dependencies via store instead of Container.get()

- **Friend Links Optimization**: Updated Friend interface and adjusted related API calls
  - Improved type safety

#### Bug Fixes

- Fixed UV migration to HLL failure
- Fixed schema validation issue in GitHub callback route
- Fixed query parameter integer parsing
- Fixed CORS preflight request handling
- Optimized code and reduced bundle size

#### Database Migrations

- Added cache table `cache` (key, type, data, created_at, updated_at)
- Added visit stats table `visit_stats` (feed_id, pv, hll_data)
- Database migration script: `0006.sql`

#### Environment Variables

New environment variable:
```ini
CACHE_STORAGE_MODE=<Cache storage mode: database or s3, default database>
```

### v0.2.0 Updated on 2024-06-07

- Added `S3_CACHE_FOLDER` environment variable
- Updated the list of encrypted environment variables, keeping only the essential ones
- Encrypted variables can now be configured directly via GitHub
- Updated GitHub variable configuration, added encrypted variables that must be configured through GitHub (S3 storage for SEO index storage)
- `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are now prefixed with `RIN_` (`RIN_GITHUB_CLIENT_ID`, `RIN_GITHUB_CLIENT_SECRET`) to solve the issue where GitHub variables cannot start with `GITHUB_`. Variables configured through the Cloudflare panel (`GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`) are not affected.

## Official upstream migration guide

For normal version updates without special instructions, simply synchronize the forked repository.

### v0.2.0 Migration Guide

- Due to the introduction of SEO optimization, it is necessary to configure S3 storage environment variables in GitHub. Therefore, you need to additionally configure the following environment variables in GitHub (plain text, add to Variables):

```ini
SEO_BASE_URL=<SEO base URL for SEO indexing>
SEO_CONTAINS_KEY=<SEO indexing only includes links starting with SEO_BASE_URL or containing the SEO_CONTAINS_KEY keyword, defaults to empty>
S3_FOLDER=<Folder for storing S3 image resources, defaults to 'images/'>
S3_CACHE_FOLDER=<S3 cache folder (for SEO and high-frequency request caching), defaults to 'cache/'>
S3_BUCKET=<Name of the S3 bucket>
S3_REGION=<Region of the S3 bucket, use 'auto' if using Cloudflare R2>
S3_ENDPOINT=<S3 bucket endpoint address>
S3_ACCESS_HOST=<S3 bucket access address, without trailing '/'>
```

Additionally, add the following encrypted environment variables (encrypted, add to Secrets):

```ini
S3_ACCESS_KEY_ID=<Your S3AccessKeyID>
S3_SECRET_ACCESS_KEY=<Your S3SecretAccessKey>
```

These environment variables were previously configured through the Cloudflare panel. Now they need to be migrated to GitHub. The new version's deployment GitHub Action will automatically upload them to Cloudflare, so you no longer need to configure these environment variables in the Cloudflare panel.