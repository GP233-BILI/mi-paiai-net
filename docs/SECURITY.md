# 安全、隐私与故障排查

## 安全设计

- 所有配置、状态和日志 API 都需要登录。
- 登录使用恒定时间比较，并对失败尝试限速。
- Session Cookie 使用 `HttpOnly` 和 `SameSite=Lax`。
- 非 GET API 检查 Origin / Fetch Metadata，阻断跨站请求。
- API 返回配置时，密码、PassToken、API Key 和 TTS Token 都被清空。
- 空密钥保存会保留原值，不会意外覆盖。
- 配置以原子方式写入，文件权限为 `0600`。
- 日志会清除常见 PassToken、Bearer Token 和 API Key。
- 容器非 root、只读、丢弃全部 Linux capability，并启用 `no-new-privileges`。
- 默认内存限制 512 MiB、PID 限制 200。

## 发布前隐私扫描

```bash
pnpm privacy-check
```

扫描内容包括：

- GitHub Personal Access Token；
- 常见 API Key；
- 带用户名/密码的 URL；
- 小米 PassToken；
- `.mi.json` 等令牌缓存；
- 已知个人化域名、NAS 用户路径和家庭 IP。

GitHub Actions 每次构建都会执行同样的检查。

## 绝对不要提交

```text
config/default.yaml
secrets/
.mi.json
.env
Docker 导出的环境变量
真实日志与家庭网络截图
```

这些路径已加入 `.gitignore`，但提交前仍应运行隐私扫描。

## 令牌泄露后的处理

1. 立即在对应平台撤销旧令牌。
2. 生成新令牌。
3. 更新本地 secret 文件。
4. 检查 Git 历史；仅删除工作区文件不够。
5. 若仓库已公开，使用干净快照重建仓库历史。

## 网络安全

- 管理端口仅应在局域网、VPN 或可信反向代理后访问。
- 不建议把 `36592` 直接映射到公网。
- HTTPS 反向代理下可以设置 `COOKIE_SECURE=true`。
- 不要为了本项目修改整台 NAS 的官方 DNS、路由、防火墙或 Docker daemon。

## 日志排查

```bash
docker logs --tail 200 mi-paiai
docker inspect mi-paiai --format '{{.State.Health.Status}}'
curl -I http://127.0.0.1:36592/
```

### 服务健康但音箱不回复

检查：

- 小米 ID、密码或 PassToken；
- 设备名称；
- AI Base URL 和 API Key；
- 模型 ID；
- 唤醒关键词；
- 实时日志的错误消息。

### 保存配置后短暂显示“启动中”

这是热加载：mi-paiai 仅重新启动音箱 Worker，不会重启 Docker 容器。通常数秒内恢复运行。

## 报告安全问题

公开 Issue 中不要提供任何账号、密钥、Token、Cookie、私有 URL 或完整日志。仅提供脱敏后的最小复现步骤。