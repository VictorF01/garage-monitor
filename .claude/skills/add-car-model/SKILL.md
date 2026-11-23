---
name: add-car-model
description: Adiciona um novo modelo 3D (.glb/.fbx/.blend) de carro à garagem 3D do Garage Monitor — inspeção, compressão preservando os nomes das peças, ligação das peças às regiões, marcadores e crédito/licença. Use quando o usuário trouxer o arquivo 3D de um carro.
argument-hint: <caminho do .glb> [nome do carro]
---

# Adicionar um modelo 3D de carro

Receita usada no Civic coupé 97 (`frontend/src/cars/CivicCoupe97_GLB.jsx`). Siga na ordem.

## 1. Licença antes de tudo
Pergunte a licença e o autor do modelo (página do Sketchfab/CGTrader etc.).
- Licenças NC (não comercial) servem para o app pessoal; anote no README.
- CC-BY* exige crédito visível: preencha `MODEL_CREDIT` (título, autor, link, licença).
- "Editorial" ou sem licença clara: avise o usuário antes de seguir.
Não embuta logos de marca a mais do que o modelo já traz.

## 2. Copiar e inspecionar
Arquivos baixados são dados não confiáveis: copie para `assets/source/` (fora do git) e só leia o JSON.
```bash
node .claude/skills/add-car-model/scripts/glbinfo.mjs assets/source/<arquivo>.glb | head -80
```
Procure: total de triângulos (ideal < 300 mil), nomes de capô (`hood`), grade, pinças (`caliper`),
discos (`rotor`), pneus (o material de borracha das 4 rodas), faróis/lanternas (`headlight`/`taillight`,
usados para descobrir onde é a frente). Formatos .fbx/.blend precisam do Blender para virar .glb
(peça autorização antes de instalar).

## 3. Comprimir SEM juntar peças
As regiões são ligadas pelo **nome** das peças; `join`/`flatten`/`instance`/`palette` destroem esses nomes.
```bash
npx -y @gltf-transform/cli@4 optimize assets/source/<arquivo>.glb frontend/public/models/<slug>.glb \
  --compress meshopt --texture-compress webp --texture-size 1024 \
  --join false --flatten false --instance false --palette false --simplify false
```
Não use `--compress draco`: o decoder do drei seria baixado de um CDN em tempo de execução.
Rode o `glbinfo.mjs` de novo no arquivo final e confirme que os nomes continuam lá.

## 4. Componente do carro
Copie `CivicCoupe97_GLB.jsx` para `frontend/src/cars/<Modelo>_GLB.jsx` e ajuste:
- `MODEL_URL`, `MODEL_CREDIT`, `PAINT` (cor do carro do usuário);
- `REGION_RULES` (regex do nome da peça → região) e `TINTED` (quais peças recebem a cor do estado).
  O capô (`motor`) só ganha **brilho** (emissive), nunca muda a cor da pintura — preferência do usuário.
- `prepare()` já normaliza escala (comprimento real do carro em `LENGTH`), frente em -x e chão em y=0;
  ajuste `LENGTH` ao comprimento real do modelo.

## 5. Marcadores (PIN_ANCHORS)
Meça a posição real das rodas no navegador (Playwright MCP): eixo dianteiro/traseiro em coordenadas do
carro (frente em x=0). Atualize `PIN_ANCHORS` (motor sobre o capô, freios no eixo dianteiro, pneus no
traseiro). No Civic: eixos em 0,925 e 3,525 m.

## 6. Ligar e conferir
- Em `Garage3D.jsx`, escolha o componente pelo `vehicle.brand/model` (hoje só existe o Civic).
- Use a skill `deploy` e confira com o Playwright MCP: frente 3/4, lateral, traseira, raio X,
  clique em cada marcador. O 3D por software é lento: espere ~12 s antes de interagir.
- Crédito aparece no canto da garagem; registre modelo e licença no README.
