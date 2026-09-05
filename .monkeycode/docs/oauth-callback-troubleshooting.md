# OAuth Callback 排查文档

> 创建时间：2026-09-05
> 状态：排查中

## 现象

1. 已注册用户 OAuth 后无法正确登录（跳转到 index，但未登录）
2. 未注册用户 OAuth 后无法显示注册页面
3. 未注册用户 OAuth 后无法显示带 code 的注册页面
4. **但 D1 数据库中确实增加了 bind code**，说明后端 callback 执行到了生成 code 的代码

## 关键发现

用户确认：
- 生产环境：`jiaoblog.dpdns.org`
- 从 `/login` 和 `/profile` 都试过
- 已登录和未登录状态都试过
- **不管是否已注册，都回到 `/` 但未登录**
- **未注册用户完全没有跳转到 `/register`**

## 已添加的调试日志

在 `server/src/services/user.ts` 的每个 OAuth callback 中添加了 `console.log`：

### GitHub callback
- 新用户分支：`github callback new user redirect: <url> redirectTo: <value>`
- 已注册用户分支：`github callback existing user redirect: <url> redirectTo: <value> hasAuthToken: <boolean>`

### Gitee callback
- 新用户分支：`gitee callback new user redirect: <url> redirectTo: <value>`
- 已注册用户分支：`gitee callback existing user redirect: <url> redirectTo: <value> hasAuthToken: <boolean>`

### QQ callback
- 新用户分支：`qq callback new user redirect: <url> redirectTo: <value>`
- 已注册用户分支：`qq callback existing user redirect: <url> redirectTo: <value> hasAuthToken: <boolean>`

## 待确认

1. 用户在生产环境触发 OAuth callback 后，Worker 日志中的输出是什么？
2. `redirectTo` 的值是什么？
3. 最终的重定向 URL 是什么？

如果日志显示：
- 新用户分支的 `redirectTo` 是 `/callback` 或 `/`，但最终 URL 是 `/register` → 说明后端逻辑正确，问题可能在前端
- 新用户分支的 `redirectTo` 是 `/`，且最终 URL 是 `/` → 说明 `redirect_to` cookie 有问题
- 新用户分支的最终 URL 是 `/callback` 或 `/` → 说明代码没有执行到生成 code 的分支（与 D1 有记录矛盾）

## 下一步

等待用户在生产环境测试并提供 Worker 日志输出。
