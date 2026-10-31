import * as path from 'path';
import { defineConfig } from '@rspress/core';

export default defineConfig({
  root: path.join(__dirname, 'docs'),
  lang: 'zh',
  title: 'Rin (羊角快车二创版)',
  description: '基于 openRin/Rin 的二次开发版博客系统。基于 Cloudflare Workers + D1 + R2，无需服务器即可部署。',
  icon: '/rin-logo-en.png',
  base: '/',
  locales: [
    {
      lang: 'en',
      label: 'English',
      title: 'Rin (Secondary Development)',
      description: 'A secondary development edition of openRin/Rin, based on Cloudflare Workers + D1 + R2, deployable without a server.',
    },
    {
      lang: 'zh',
      label: '简体中文',
      title: 'Rin (羊角快车二创版)',
      description: '基于 Cloudflare 的动态博客系统 (二次开发版)',
    },
    {
      lang: 'zh-TW',
      label: '繁體中文',
      title: 'Rin (羊角快車二創版)',
      description: '基於 Cloudflare 的動態部落格系統 (二次開發版)',
    },
    {
      lang: 'ja',
      label: '日本語',
      title: 'Rin (羊角快车二次開発版)',
      description: 'Cloudflare ベースの動的ブログシステム（二次開発版）',
    },
  ],
  themeConfig: {
    socialLinks: [
      { icon: 'github', mode: 'link', content: 'https://github.com/wool-hmq/Rin' },
    ],
  },
  i18nSource: {
    outlineTitle: {
      zh: '大纲',
      'zh-TW': '大綱',
      en: 'ON THIS PAGE',
      ja: 'このページの内容',
    },
  },
});
