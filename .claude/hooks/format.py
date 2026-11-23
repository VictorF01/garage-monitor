#!/usr/bin/env python3
"""PostToolUse (Edit|Write): formata o arquivo editado (ruff no backend, prettier no frontend)."""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
path = Path(json.load(sys.stdin).get("tool_input", {}).get("file_path", ""))

try:
    rel = path.resolve().relative_to(ROOT)
except ValueError:
    sys.exit(0)  # fora do projeto

if rel.parts[:1] == ("backend",) and path.suffix == ".py":
    cmd = ["uvx", "ruff", "format", "--quiet", str(path)]
elif rel.parts[:2] == ("frontend", "src") and path.suffix in {".js", ".jsx", ".css", ".json"}:
    cmd = [str(ROOT / "frontend/node_modules/.bin/prettier"), "--write", "--log-level", "warn", str(path)]
else:
    sys.exit(0)

r = subprocess.run(cmd, cwd=ROOT / rel.parts[0], capture_output=True, text=True, timeout=60)
if r.returncode != 0:
    # Não bloqueia a edição; só avisa o Claude (ex.: erro de sintaxe que o formatador detectou).
    print(f"Formatador falhou em {rel}:\n{r.stderr or r.stdout}", file=sys.stderr)
    sys.exit(2)
