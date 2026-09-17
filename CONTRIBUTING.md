# 贡献指南

感谢你改进 mi-paiai。

## 开发环境

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm privacy-check
pnpm typecheck
pnpm test
```

## 提交前必须通过

- `pnpm privacy-check`：不得包含任何密钥、Token、私有 IP 或个人路径
- `pnpm typecheck`
- `pnpm test`

## Pull Request 要求

1. 一个 PR 只做一件事，说明动机与影响范围。
2. 涉及界面改动请附上截图（请先脱敏）。
3. 涉及行为改动请补充或更新 `tests/`。
4. 不要提交 `data/`、`secrets/`、`.mi.json`、`.env` 或任何真实配置。

## 代码风格

- TypeScript strict 模式
- 不要引入新的运行时依赖，除非确有必要
- 用户可见文案使用简体中文，保持简洁
- 所有 API 必须保持登录保护与密钥脱敏

## 上游关系

mi-paiai 基于 `zhuzhu88920/migpt-ultimate` 与 `idootop/migpt-next`。
修改上游行为时请在 PR 描述中说明与上游的差异，便于后续同步。