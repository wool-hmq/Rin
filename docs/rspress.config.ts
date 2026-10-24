import * as path from 'path';
import { defineConfig } from '@rspress/core';

export default defineConfig({
  root: path.join(__dirname, 'docs'),
  lang: 'zh',
  // 1. 修改标题和描述，体现二创版特色
  title: 'Rin (羊角快车二创版)',
  description: '基于 openRin/Rin 的二次开发版博客系统。基于 Cloudflare Pages + Workers + D1 + R2，无需服务器即可部署。',
  icon: '/rin-icon.png',
  // 2. 指定 GitHub Pages 的子路径 (如果是自己域名则写 '/')
  base: '/Rin/', 
  locales: [
    {
      lang: 'en',
      label: 'English',
      title: 'Rin (Secondary Development)',
      description: 'A secondary development edition of openRin/Rin, based on Cloudflare.',
    },
    {
      lang: 'zh',
      label: '简体中文',
      title: 'Rin (羊角快车二创版)',
      description: '基于 Cloudflare 的动态博客系统 (二次开发版)',
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
      en: 'ON THIS Page',
    },
  },
});
