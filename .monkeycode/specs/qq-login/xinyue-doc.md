# 心月互联 QQ 登录接入文档

> 来源：心月云博客文章《心月互联 - 让每一个网站都能用上QQ登录》
> 原文地址：https://m.wch666.com/?/archives/127 （原链接 `m.wch666.com/archives/127` 已改为 query 路由格式）
> 服务主页：https://qq.wch666.com/

## 前言

为了提高用户的使用体验，通常会支持多种账号登录方式，比如：手机号验证码登录、账号密码登录、应用授权登录，邮箱登录等等。

今天带来的是QQ登录，但是吧，QQ登录属于第三方应用，如果要集成，得去申请，而申请又需要项目上线，因为工作人员需要对你的网站进行审核，如果符合要求，才同意。

如果正处于开发时，那大概率是无法申请的，项目可能都还没上线，而且还需要域名备案等前置条件。

再者是一些小项目，可能是平时老师期末吩咐的小作业，毕业设计，或是因为其他等等因素，从而无法正常完成申请。

所以，为了解决以上痛点，于是**心月互联**，便应运而生。

总之一句话：无论你的项目部署在公网，还是本地，都能支持QQ登录。

而且，本应用完全免费，不需要登录，不需要填一大堆信息，简单而直接！

心月互联地址：[https://qq.wch666.com/](https://qq.wch666.com/)

## 原理

如图所示：

![](https://wen0224.oss-accelerate.aliyuncs.com/blog_src/202505181.png)

看起来挺复杂，你只需关注图中的实线部分，图中的实线表示你需要做的，虚线则是不需要操作，自动完成。

## 开发文档

### 前端

需要QQ登录的地方，可以放个按钮，让按钮点一下就跳转到这个地址：

```text
https://qq.wch666.com/api/qq.php?token=[你的token]&msg=[你想携带的信息]&display['pc'|'mobile']
```

> token，直接在我的心月互联申请，
> msg，这个是携带的信息，可以不携带，
> display，这个是显示方式，pc表示PC端，mobile表示移动端，如果你不传，那就自动选择
>
> （申请的token并非是永久的，默认只有30天有效期，你可以反复申请）

### 后端

你**需要准备一个接口**，用于申请token，

当前QQ登录成功后，会自动跳转到这个接口，并且会通过GET方式传过来两个参数：

* code 用于后续你获取用户信息
* msg 你前面想携带的信息，如果你前面没有携带，这里会为空

**获取用户信息**

接口地址：

```text
https://qq.wch666.com/api/get_user_info.php?code=[传来的code]
```

## 案例

### 前端代码：

```html
<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <title>心月互联</title>
</head>
<body>
    <div class="container">
        <h1>
            <a href="https://qq.wch666.com/api/qq.php?token=07c49f6680c0d2a271c8b2dc6516a63">QQ登录</a>
        </h1>
    </div>
</body>
</html>
```

### 后端代码：

```php
<?php

$code = $_GET['code'];
$msg = $_GET['msg'];

if(!isset($code)){
  echo 'error';
  exit();
}

echo '<h1>用户的回调函数</h1>';

// 发起请求，获取用户信息
echo file_get_contents("https://qq.wch666.com/api/get_user_info.php?code=$code");

```

### 视频教程

如果文档没看懂，那来看看视频，视频中讲得更详细，有完整的演示。

[点击观看](https://www.bilibili.com/video/BV1BqJVzPEnZ/)

### 题外话

如果你想自己去官方平台申请QQ登录，可以看看我的这篇文章，也许对你有帮助

[https://wch666.com/archives/87](https://wch666.com/archives/87)
