# Garage Monitor

Acompanha a vida útil das peças e manutenções do carro. Cada item (peça ou serviço) tem uma
vida útil em **km** e/ou **meses**. Quando você registra uma troca, o item volta a **100%** e vai
caindo conforme o hodômetro sobe e o tempo passa. Vale o critério que vencer primeiro.

- **Frontend:** React + Vite, servido pelo nginx (que também encaminha `/api` para o backend)
- **Backend:** Python / FastAPI + SQLAlchemy
- **Banco:** PostgreSQL
- **Garagem 3D:** three.js / React Three Fiber. O carro (modelo procedural do Civic coupé 97 em
  `frontend/src/cars/CivicCoupe97_3D.jsx`) fica numa plataforma giratória; cada região (motor,
  arrefecimento, câmbio, freios, pneus) muda de cor conforme a vida útil e é clicável. Sem WebGL,
  o app usa o desenho 2D (`CivicCoupe97.jsx`).
- **Manual do carro:** envio de PDF e sugestão do plano de manutenção por IA: modelo local via
  **Ollama** (padrão, sem custo) ou **Claude** (`claude-opus-5-5`, via `LLM_PROVIDER=anthropic`)

## Como rodar

```bash
cp .env.example .env        # ajuste a senha e coloque sua ANTHROPIC_API_KEY
docker-compose up -d --build
```

- App: http://localhost:3000
- Documentação da API: http://localhost:8000/docs

## Volumes persistentes

São necessários, sim. Sem eles, os dados ficam na camada gravável do container e são apagados
quando ele é recriado (`docker-compose down`, rebuild, atualização de imagem).

| Volume    | Montado em                 | Conteúdo                    |
|-----------|----------------------------|-----------------------------|
| `pgdata`  | `/var/lib/postgresql/data` | Banco de dados              |
| `uploads` | `/data/uploads` (backend)  | PDFs dos manuais enviados   |

`docker-compose down` mantém os volumes; **`docker-compose down -v` apaga tudo**.

Backup do banco:

```bash
docker-compose exec db pg_dump -U mechhelper mechhelper > backup.sql
```

## Como a vida útil é calculada

```
uso_km    = (km_atual - km_na_troca) / intervalo_km
uso_tempo = dias_desde_a_troca / (intervalo_meses × 30,44)
vida      = 100% × (1 - max(uso_km, uso_tempo)),  limitada a 0–100%
```

Status: `ok` (> 20%), `atencao` (≤ 20%), `vencido` (0%), `sem_registro` (nenhuma troca registrada).

A parte em km depende de você manter o hodômetro atualizado. Registrar um serviço com km maior
que o atual também atualiza o hodômetro.

## Sugestões a partir do manual

1. Envie o PDF do manual na seção "Manual do carro".
2. Clique em "Sugerir manutenções".
3. Marque os itens que quer cadastrar. Os que já existem com o mesmo nome vêm desmarcados.

### Com Ollama (padrão)

O Ollama roda **no host** (fora do Docker) para usar a GPU, e precisa aceitar conexões dos
containers:

```bash
sudo mkdir -p /etc/systemd/system/ollama.service.d
printf '[Service]\nEnvironment="OLLAMA_HOST=0.0.0.0:11434"\n' | sudo tee /etc/systemd/system/ollama.service.d/override.conf
sudo systemctl daemon-reload && sudo systemctl restart ollama
ollama pull qwen2.5:3b
```

Isso deixa o Ollama aberto em todas as interfaces da máquina. Em rede doméstica/WSL costuma
ser ok; não exponha a porta 11434 para a internet.

Como funciona: o backend extrai o texto do PDF (PyMuPDF), escolhe as páginas que mais falam de
manutenção (palavras-chave em português e inglês, menções a km/milhas/meses), manda em blocos
ao modelo e junta os resultados. Limitações:

- PDFs **escaneados sem texto** (só imagem) não funcionam ainda: falta OCR.
- Tabelas cujo texto saiu ilegível no OCR do PDF não são lidas; o modelo aproveita os
  intervalos citados nos textos dos procedimentos.
- Modelos pequenos (3B) erram mais. Revise as sugestões antes de aceitar. Com mais VRAM, use
  um modelo maior em `OLLAMA_MODEL` e aumente `OLLAMA_NUM_CTX`.

### Com Claude

Defina `LLM_PROVIDER=anthropic` e `ANTHROPIC_API_KEY` no `.env`. O PDF é enviado pela Files API
da Anthropic e apagado de lá após a análise. O Claude lê o PDF como imagem também (entende
tabelas e páginas escaneadas), mas o limite é 600 páginas por documento. Cada análise gera custo.

Upload: até 100 MB (configurável em `MAX_UPLOAD_MB`).

## Desenvolvimento sem Docker

```bash
# banco
docker-compose up -d db

# backend
cd backend && python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
UPLOAD_DIR=./uploads uvicorn app.main:app --reload

# frontend (em outro terminal)
cd frontend && npm install && npm run dev   # http://localhost:5173
```

## Próximos passos sugeridos

- Migrações com Alembic (hoje as tabelas são criadas com `create_all`)
- Histórico de leituras do hodômetro para estimar km/mês e prever a data da próxima troca
- Notificações (e-mail/push) quando um item entrar em "atenção"
- Autenticação, se for acessar de fora da sua rede

## Modelo 3D do carro

A garagem usa `frontend/public/models/civic-coupe-97.glb` ("1999 Honda Civic Si", do Sketchfab, licença
[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)): **somente uso não comercial**, com crédito
ao autor, ZD 3D Modelling and Design (discord.gg/ZwWHzxk2zu), exibido no canto da garagem (`MODEL_CREDIT` em `src/cars/CivicCoupe97_GLB.jsx`). As cores das
regiões são modificações nossas. Se o arquivo não carregar, o app usa o modelo procedural (`CivicCoupe97_3D.jsx`).
O original baixado fica em `assets/source/`.
