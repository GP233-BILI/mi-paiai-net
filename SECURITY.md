# 安全策略

## 支持的版本

仅最新 release tag 与 `master` 分支接受安全修复。

## 报告漏洞

请通过 GitHub 的 **Security → Report a vulnerability** 私密渠道报告，
不要创建公开 Issue，也不要在任何渠道粘贴：

- 小米账号、密码、PassToken
- 模型 API Key、TTS Token
- 面板密码与会话 Cookie
- 家庭 IP、私有域名、NAS 路径
- 未脱敏的完整日志

## 响应流程

1. 确认收到报告（通常 3 天内）。
2. 复现并评估影响范围。
3. 在私有分支修复并测试。
4. 发布新版本并在 Release Notes 中致谢（如你希望署名）。

## 使用者自查

```bash
pnpm privacy-check
```

仓库的 CI 也会在每次构建前运行相同的检查。
如发现密钥曾出现在 Git 历史中，仅删除文件是不够的：请先轮换密钥，再重建仓库历史。