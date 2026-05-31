# TechShop Docs Pack

Bộ docs này được tạo để định hướng xây dựng dự án TechShop theo vai trò BA, Design, SA/Techlead và DevOps.

## Files

| File | Vai trò |
|---|---|
| `BUSINESS_ANALYSIS.md` | BA: phân tích nghiệp vụ, requirements, use cases, datasets, acceptance criteria |
| `UI_STITCH_PROMPT.md` | Design: prompt đưa vào Stitch để sinh UI |
| `PROJECT.md` | Techlead: project guide, service list, roadmap, done criteria |
| `ARCHITECTURE.md` | SA: kiến trúc microservices, diagrams, DB, AI/RAG architecture |
| `CODING_CONVENTION.md` | Techlead: coding standard, API convention, service structure |
| `DEPLOYS.md` | DevOps: Docker Compose, gateway, env, migration, healthcheck, monitoring |

## Recommended Usage

1. Copy docs vào root repo.
2. Đưa `PROJECT.md`, `ARCHITECTURE.md`, `CODING_CONVENTION.md` vào AI coding agent context.
3. Dùng `UI_STITCH_PROMPT.md` để generate UI.
4. Build theo order trong `PROJECT.md`.
5. Dùng `DEPLOYS.md` để chuẩn hóa Docker/deploy.

## Current Runtime Conventions

- Runtime env chỉ dùng một file duy nhất: root `.env`.
- Gateway public port hiện tại là `1912`.
- AI runtime dùng OpenAI-compatible API qua `OPENAI_BASE_URL=https://api.yescale.io/v1`.
