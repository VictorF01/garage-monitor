---
name: deploy
description: Testa, recria os containers do Garage Monitor (backend e/ou frontend) e confere se a API e a página voltaram. Use depois de mudar o código, quando o usuário pedir para publicar/subir/aplicar as mudanças.
argument-hint: [backend|frontend|all]
disable-model-invocation: true
---

# Deploy local (Docker Compose)

Alvo: `$ARGUMENTS` (vazio = `all`). Rode a partir da raiz `/opt/mech-helper`. O binário é `docker-compose`.

1. **Checagens rápidas** (pare e mostre o erro se algo falhar):
   - backend: `cd backend && uv run --no-project --with pytest python -m pytest -q && uvx ruff check .`
   - frontend: `cd frontend && npx prettier --check src && npm run build && rm -rf dist`
     (o build local só valida; a imagem refaz o build dentro do Docker).
2. **Recriar**: `docker-compose up -d --build <backend|frontend|backend frontend>`.
   **Nunca** use `down -v` nem remova volumes: o histórico do usuário vive no volume `pgdata`.
3. **Conferir**:
   - `curl -sf localhost:8000/api/health` (backend; as migrações rodam no start — se falhar, `docker-compose logs --tail 50 backend`);
   - `curl -s localhost:3000/ | grep -o "<title>.*</title>"` → `Garage Monitor`;
   - mudança visual: abra http://localhost:3000 com o Playwright MCP e tire um print.
4. Responda em uma linha por serviço: o que subiu e o resultado das checagens.
