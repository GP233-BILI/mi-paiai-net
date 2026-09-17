# Attribution and notices

`mi-paiai` is an independent community-maintained derivative project.

## Upstream projects

1. **MiGPT-Next** — <https://github.com/idootop/migpt-next>
   - Original author: Del Wang (`idootop`)
   - License: MIT
   - `mi-paiai` continues to use the upstream npm packages `@mi-gpt/next`, `@mi-gpt/chat`, and `@mi-gpt/openai`.

2. **MiGPT Ultimate** — <https://github.com/zhuzhu88920/migpt-ultimate>
   - Original implementation and initial web/CLI monorepo by `zhuzhu88920`.
   - That project stated that it was based on MiGPT-Next.

## Major changes in mi-paiai

Compared with the initial MiGPT Ultimate codebase, this project adds or substantially rewrites:

- authenticated and hardened web management;
- secret redaction and atomic configuration writes;
- multi-speaker process and conversation isolation;
- live configuration reload without restarting the container;
- voice-controlled model and reasoning-level switching;
- ordered model selection and upstream model discovery;
- provider presets for OpenAI-compatible services;
- responsive sky-blue management UI and chronological smart-follow logs;
- multi-architecture container builds and automated privacy checks;
- security tests, runtime isolation tests, and deployment documentation.

## Trademarks and services

Xiaomi, XiaoAI, OpenAI, Gemini, DeepSeek, Grok, GLM, Qwen and other names are trademarks of their respective owners. This project is not affiliated with or endorsed by Xiaomi or any model provider.