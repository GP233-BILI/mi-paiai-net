# 安装教程

本教程适用于普通 Linux 服务器、群晖/威联通/小米等 NAS，以及 ARM 单板机。

## 1. 架构支持

| 平台 | 镜像平台 |
|---|---|
| Intel / AMD 64 位 | `linux/amd64` |
| ARM64 NAS / 树莓派 4/5 | `linux/arm64` |
| 32 位 ARMv7 | `linux/arm/v7` |

Docker 会自动选择正确架构，不需要手动添加后缀。

## 2. Docker Compose 安装

### 2.1 获取文件

```bash
git clone https://github.com/clawpai/mi-paiai.git
cd mi-paiai
```

### 2.2 创建持久化目录

```bash
mkdir -p data/config data/secrets
```

数据目录说明：

```text
data/
├── config/     # default.yaml，应用配置
└── secrets/    # 面板登录凭据，仅容器只读挂载
```

### 2.3 生成面板凭据

```bash
printf '%s\n' 'admin' > data/secrets/auth_username
openssl rand -base64 24 > data/secrets/auth_password
openssl rand -base64 48 > data/secrets/auth_secret
chmod 600 data/secrets/*
sudo chown -R 1000:1000 data
```

`auth_password` 至少 12 位；`auth_secret` 至少 32 位。

### 2.4 启动

```bash
docker compose pull
docker compose up -d
docker compose ps
```

浏览器访问：

```text
http://服务器IP:36592
```

查看登录密码：

```bash
cat data/secrets/auth_password
```

## 3. NAS 大硬盘部署

建议把 `data` 放在大容量数据盘，而不是 Docker 的小系统分区。例如：

```text
/mnt/storage/docker/mi-paiai/config
/mnt/storage/docker/mi-paiai/secrets
```

然后修改 `docker-compose.yml`：

```yaml
volumes:
  - /mnt/storage/docker/mi-paiai/config:/app/config
  - /mnt/storage/docker/mi-paiai/secrets:/run/secrets:ro
```

只移动本项目自己的目录。不要手动修改 Docker 的 `overlay2`、`containers`、`image` 或厂商系统容器。

## 4. host 网络模式

普通系统优先使用默认 bridge 网络和端口映射。如果出现以下情况，可改用 host 网络：

- 容器能启动，但无法连接小米或 AI 接口；
- NAS 的 Docker bridge DNS 不可用；
- 日志持续显示域名解析或连接超时。

Compose 修改：

```yaml
services:
  mi-paiai:
    network_mode: host
    # 使用 host 后删除 ports
```

不要为了本项目修改整台 NAS 的 DNS、默认路由、防火墙或 Docker daemon。

## 5. 更新

```bash
docker compose pull
docker compose up -d --remove-orphans
```

持久化配置位于 `data/config` 和 `data/secrets`，更新镜像不会覆盖它们。

## 6. 卸载

```bash
docker compose down
```

如需彻底删除个人数据，再手动删除项目自己的 `data` 目录。不要运行全局 `docker system prune -a`，它可能影响同一 NAS 上的其他容器。

## 7. 从源码构建

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm privacy-check
pnpm typecheck
pnpm test
docker build -t mi-paiai:local .
```

## 8. 常见问题

### 页面打不开

```bash
docker ps --filter name=mi-paiai
docker logs --tail 100 mi-paiai
curl -I http://127.0.0.1:36592/
```

### Permission denied

确保挂载目录可由容器 UID 1000 写入：

```bash
sudo chown -R 1000:1000 data
sudo chmod 700 data/config data/secrets
sudo chmod 600 data/secrets/*
```

### 小米登录需要验证码

优先填写 PassToken。不要把 PassToken 发到 Issue、群聊或截图中。