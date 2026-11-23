"""Leitura do manual do carro (PDF) por um LLM para sugerir o plano de manutenção.

O provedor é escolhido por LLM_PROVIDER: "ollama" (local, padrão) ou "anthropic".
"""

import os
import unicodedata
from pathlib import Path

from .schemas import Suggestion

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama").lower()

SYSTEM_PROMPT = """Você analisa manuais de proprietário de veículos e extrai o plano de \
manutenção preventiva (revisões programadas) para um app que acompanha a vida útil de \
cada peça e serviço.

Para cada item do plano, informe o intervalo em km e/ou em meses exatamente como o \
manual define (quando o manual diz "o que ocorrer primeiro", preencha os dois). Use \
o regime de uso normal; se houver intervalo diferente para uso severo, mencione-o em \
`notes`. Não invente intervalos que não estejam no manual: use null quando o manual \
não define aquele critério. Agrupe repetições do mesmo item em uma única entrada. \
Escreva os nomes em português, curtos e claros (ex.: "Óleo do motor", "Filtro de ar \
do motor", "Fluido de freio"), mesmo que o manual esteja em outro idioma.

Os intervalos devem estar em km. Se o manual trouxer milhas e km, use o valor em km; \
se trouxer só milhas, converta (1 milha = 1,609 km) e arredonde. O texto pode ter vindo \
de OCR e conter erros de digitação: interprete com bom senso, mas não chute números \
ilegíveis."""


class ManualAIError(Exception):
    pass


def _key(name: str) -> str:
    text = unicodedata.normalize("NFD", name.lower())
    return " ".join("".join(c for c in text if unicodedata.category(c) != "Mn").split())


def merge_suggestions(items: list[Suggestion]) -> list[Suggestion]:
    """Junta itens repetidos (o modelo local vê o manual em partes e pode repetir itens)."""
    merged: dict[str, Suggestion] = {}
    for s in items:
        k = _key(s.name)
        if not k:
            continue
        if k not in merged:
            merged[k] = s.model_copy()
            continue
        cur = merged[k]
        cur.interval_km = cur.interval_km or s.interval_km
        cur.interval_months = cur.interval_months or s.interval_months
        if s.notes and s.notes not in (cur.notes or ""):
            cur.notes = f"{cur.notes}; {s.notes}" if cur.notes else s.notes
    # Sem nenhum intervalo o item não serve para calcular vida útil.
    return [s for s in merged.values() if s.interval_km or s.interval_months]


def suggest_from_manual(pdf_path: Path, vehicle_desc: str) -> list[Suggestion]:
    if LLM_PROVIDER == "anthropic":
        from . import llm_anthropic as provider
    elif LLM_PROVIDER == "ollama":
        from . import llm_ollama as provider
    else:
        raise ManualAIError(f"LLM_PROVIDER inválido: {LLM_PROVIDER!r} (use 'ollama' ou 'anthropic')")
    return merge_suggestions(provider.suggest(pdf_path, vehicle_desc))
