![](./assets/img/logo.png) 聚合登录

* [首页](./)
* [用户中心](./user/)
* 开发文档
* [接口测试](./user/test.php)
* [联系我们](https://wpa.qq.com/msgrd?v=3&uin=917773673&site=qq&menu=yes)

## 开发文档

[聚合登录介绍](#doc1)
[接口协议规则](#doc2)
[聚合登录流程](#doc3)
[获取用户信息](#doc4)
[SDK下载](#doc5)

聚合登录介绍

聚合登录，就是利用用户在第三方平台上已有的账号来快速完成自己应用的登录流程。这里的第三方平台，是指QQ、微信、微博、百度等平台。通过本站的聚合登录接口，你的网站可以登录获取相应的用户信息和授权信息，例如uid、token、用户昵称、头像等。本站的聚合登录完全符合OAuth2.0身份鉴权机制。

接口协议规则

传输方式：HTTP

数据格式：JSON

字符编码：UTF-8

聚合登录流程

**Step1：获取跳转登录地址**
请求URL：
`https://login.mapay.cn/connect.php?act=login&appid={你的appid}&appkey={你的appkey}&type={登录方式}&redirect_uri={返回地址}`
其中登录方式对应值：

| 对应值 | 登录方式名称 |
| --- | --- |
| qq | ＱＱ |
| wx | 微信 |
| alipay | 支付宝 |

返回格式：

```
{
  "code": 0,
  "msg": "succ",
  "type": "qq",
  "url": "https://graph.qq.com/oauth2.0/XXXXXXXXXX"
}
```

返回参数说明：

| 参数名 | 参数类型 | 参数说明 | 参数示例 |
| --- | --- | --- | --- |
| code | int | 返回状态码 | 0为成功，其它值为失败 |
| msg | string | 返回信息 | 返回错误时的说明 |
| type | string | 登录方式 | qq |
| url | string | 登录跳转地址 | https://graph.qq.com/oauth2.0/XXXXXXXXXX |
| qrcode | string | 登录扫码地址 | 此地址仅微信和支付宝返回 |

**Step2：跳转到登录地址**
登录地址为上一步返回的url的值。

**Step3：登录成功会自动跳转到指定的redirect\_uri，并跟上Authorization Code**
例如回调地址是：www.qq.com/my.php，则会跳转到：
`http://www.qq.com/my.php?type=qq&code=520DD95263C1CFEA0870FBB66E******`

**Step4：通过Authorization Code获取用户信息**
请求URL：
`https://login.mapay.cn/connect.php?act=callback&appid={appid}&appkey={appkey}&type={登录方式}&code={code}`
返回格式：

```
{
  "code": 0,
  "msg": "succ",
  "type": "qq",
  "access_token": "89DC9691E274D6B596FFCB8D43368234",
  "social_uid": "AD3F5033279C8187CBCBB29235D5F827",
  "faceimg": "https://thirdqq.qlogo.cn/g?b=oidb&k=3WrWp3peBxlW4MFxDgDJEQ&s=100&t=1596856919",
  "nickname": "大白",
  "location": "XXXXX市",
  "gender": "男",
  "ip": "1.12.3.40"
}
```

返回参数说明：

| 参数名 | 参数类型 | 参数说明 | 参数示例 |
| --- | --- | --- | --- |
| code | int | 返回状态码 | 0为成功，2为未完成登录，其它值为失败 |
| msg | string | 返回信息 | 返回错误时的说明 |
| type | string | 登录方式 | qq |
| social\_uid | string | 第三方登录UID | AD3F5033279C8187CBCBB29235D5F827 |
| access\_token | string | 第三方登录token | 89DC9691E274D6B596FFCB8D43368234 |
| faceimg | string | 用户头像 | https://thirdqq.qlogo.cn/g?...... |
| nickname | string | 用户昵称 | 消失的彩虹海 |
| gender | string | 用户性别 | 男 |
| location | string | 用户所在地 | XXXXX市(仅限支付宝/微信返回) |
| ip | string | 用户登录IP | 1.12.3.40 |

获取用户信息接口

在用户登录后的任意时间，可以请求以下接口再次查询用户的详细信息。

请求URL：
`https://login.mapay.cn/connect.php?act=query&appid={appid}&appkey={appkey}&type={登录方式}&social_uid={social_uid}`
social\_uid就是用户的第三方登录UID，用于识别用户的唯一字段。

返回格式：

```
{
  "code": 0,
  "msg": "succ",
  "type": "qq",
  "social_uid": "AD3F5033279C8187CBCBB29235D5F827",
  "access_token": "89DC9691E274D6B596FFCB8D43368234",
  "nickname": "大白",
  "faceimg": "https://thirdqq.qlogo.cn/g?b=oidb&k=ianyRGEnPZlMV2aQvvzg2uA&s=100&t=1599703185",
  "location": "XXXXX市",
  "gender": "男",
  "ip": "1.12.3.40"
}
```

返回参数说明：

| 参数名 | 参数类型 | 参数说明 | 参数示例 |
| --- | --- | --- | --- |
| code | int | 返回状态码 | 0为成功，其它值为失败 |
| msg | string | 返回信息 | 返回错误时的说明 |
| type | string | 登录方式 | qq |
| social\_uid | string | 第三方登录UID | AD3F5033279C8187CBCBB29235D5F827 |
| access\_token | string | 第三方登录token | 89DC9691E274D6B596FFCB8D43368234 |
| faceimg | string | 用户头像 | https://thirdqq.qlogo.cn/g?...... |
| nickname | string | 用户昵称 | 消失的彩虹海 |
| gender | string | 用户性别 | 男 |
| location | string | 用户所在地 | XXXXX市(仅限支付宝/微信返回) |
| ip | string | 用户登录IP | 1.12.3.40 |

SDK下载

SDK版本：1.0

[点击下载](./assets/files/SDK.zip)

Copyright ©2026 聚合登录  [豫ICP备2022011606号](https://beian.miit.gov.cn/)