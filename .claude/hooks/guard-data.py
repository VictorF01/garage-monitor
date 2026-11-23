#!/usr/bin/env python3
"""PreToolUse (Bash): bloqueia comandos que apagam os dados do app.

Todo o histórico de manutenção vive no volume Docker `pgdata` (e os PDFs em `uploads`).
Esses comandos não têm volta, então o Claude precisa pedir ao usuário para rodá-los.
"""
import json
import re
import sys

cmd = json.load(sys.stdin).get("tool_input", {}).get("command", "")

DOCKER = [
    (r"\bdown\b[^|;&]*\s(-v|--volumes)\b", "docker-compose down -v apaga os volumes (banco e manuais)"),
    (r"\bvolume\s+(rm|prune)\b", "remover volumes Docker apaga o banco e os manuais"),
    (r"\bsystem\s+prune\b[^|;&]*--volumes", "docker system prune --volumes apaga os volumes"),
    (r"\bdropdb\b", "dropdb apaga o banco inteiro"),
]
SQL = [  # só vale para comandos que mandam SQL ao banco (evita falso positivo em mensagens de commit etc.)
    (r"\b(drop\s+(database|schema|table)|truncate)\b", "DROP/TRUNCATE apaga dados do banco"),
    (r"\bdelete\s+from\s+\w+\s*(;|\"|'|$)", "DELETE sem WHERE apaga a tabela inteira"),
]

rules = DOCKER + (SQL if re.search(r"\bpsql\b", cmd) else [])
for pattern, reason in rules:
    if re.search(pattern, cmd, re.IGNORECASE):
        print(
            f"Bloqueado pelo hook guard-data: {reason}. "
            "Se for mesmo necessário, explique ao usuário e peça para ele rodar o comando com `! <comando>`.",
            file=sys.stderr,
        )
        sys.exit(2)
