# Garage Monitor

App pessoal (de desenvolvimento) para acompanhar a manutenção do carro do usuário — um Honda Civic coupé 1997
("Civic Ryujin", carro piloto). Cada peça/serviço tem vida útil que começa em 100% na troca e cai com km e tempo.
Interface e textos em **português do Brasil**; converse com o usuário em português.

## Stack
- `backend/` — FastAPI + SQLAlchemy 2 + psycopg 3 + Pydantic v2 (Python 3.13 no container).
- `frontend/` — React 19 + Vite 7; garagem 3D com three.js / @react-three/fiber / drei / postprocessing.
- `docker-compose.yml` — `db` (postgres:17), `backend` (:8000), `frontend` (nginx, :3000, faz proxy de `/api`).
- Use o binário `docker-compose` (com hífen).

## Comandos
- Deploy: skill `/deploy [backend|frontend|all]` (testes → build → `docker-compose up -d --build <svc>` → checagens).
- Testes backend: `cd backend && uv run --no-project --with pytest python -m pytest -q`
- Lint/format: `cd backend && uvx ruff check . && uvx ruff format .` · `cd frontend && npm run format`
  (um hook PostToolUse já formata cada arquivo editado).
- Build frontend local só para validar: `cd frontend && npm run build && rm -rf dist` (a imagem refaz o build).
- Banco (leitura): MCP `garage-db` (usuário `claude_ro`, somente leitura; ver `scripts/readonly-role.sql`).
- Navegador: MCP `playwright`. O 3D roda por software aqui e é lento — espere ~12 s antes de interagir;
  para testar fluxos sem 3D, devolva `null` em `getContext("webgl2")` e o app usa o desenho SVG.

## Regras de negócio
- `backend/app/life.py`: vida = mínimo entre critério de km e de tempo ("o que vencer primeiro");
  ≤20% → `atencao`, 0% → `vencido`; sem registro → `sem_registro`.
- `backend/app/regions.py`: regiões do carro por palavras-chave; a ordem das regras importa (coberta por testes).
- Exclusões são **reversíveis**: `deleted_at` em veículos, itens e registros; endpoints `/restore`;
  a UI mostra "Desfazer" por 10 s e uma lixeira de itens. Não volte a apagar de verdade.
- Escala de cores da vida útil (frontend `regions.js`): azul >75, verde 50–75, amarelo 25–50, vermelho <25.
- O plano de manutenção do Civic foi montado a partir do manual de serviço Honda 96–00 (intervalos de uso severo).

## Schema / migrações
Sem Alembic: `create_all` + `_migrate()` idempotente em `main.py` (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`).
Nova coluna em tabela existente → adicione no `_migrate()` também.

## Dados do usuário — cuidado
- Todo o histórico vive no volume Docker `pgdata` (PDFs em `uploads`). Nunca rode `down -v`, remova volumes
  ou apague linhas reais; o hook `guard-data` bloqueia os casos óbvios. Dados de teste: crie e remova você mesmo.
- O banco e a pasta ainda se chamam `mechhelper`/`mech-helper` de propósito (o app já se chamou Mech Helper
  e Oficina 3D). Renomear exigiria migrar volumes.

## Garagem 3D
- Modelo: `frontend/public/models/civic-coupe-97.glb` — "1999 Honda Civic Si" de ZD 3D Modelling and Design,
  **CC BY-NC-SA 4.0 (somente uso não comercial)**, crédito exibido no canto da garagem. Original em `assets/source/` (fora do git).
- `src/cars/CivicCoupe97_GLB.jsx` liga peças às regiões **pelo nome** (capô → motor, grade → arrefecimento,
  pinças/discos → freios, borracha → pneus). Pintura prata; o capô só ganha **brilho** na cor do estado.
- Fallbacks: modelo procedural `CivicCoupe97_3D.jsx` (se o .glb falhar) e SVG `CivicCoupe97.jsx` (sem WebGL2).
- Novo carro: skill `add-car-model` (compressão meshopt **sem** join/flatten, nada de draco).

## Estilo visual
Tema escuro "garagem neon" em todo o app: fundo `#05060b`, roxo `#a855f7`, ciano `#22d3ee`, barras de vida em
neon na cor do estado. O usuário aprovou esse visual — mantenha componentes novos consistentes com ele.

## LLM (sugestões a partir do manual)
`LLM_PROVIDER=ollama` (padrão, `qwen2.5:3b`) ou `anthropic` (`claude-opus-5-5`, Files API). O Ollama está
desligado por enquanto; o botão "Sugerir manutenções" mostra erro de conexão — é esperado.
