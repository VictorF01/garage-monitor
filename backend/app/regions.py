"""Regiões do carro usadas no diagrama interativo.

As chaves são genéricas (valem para qualquer modelo); cada desenho no frontend
decide onde cada região fica.
"""

import unicodedata

REGIONS = ["motor", "arrefecimento", "transmissao", "freios", "pneus", "suspensao", "eletrica", "outros"]

# Ordem importa: a primeira regra que casar vence ("fluido de freio" é freio, não motor;
# "disco de embreagem" é transmissão, não freio).
_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("transmissao", ("transmiss", "cambio", "embreagem", "atf", "mtf", "cvt", "diferencial")),
    ("freios", ("freio", "pastilha", "disco", "lona", "pinca", "abs")),
    ("arrefecimento", ("arrefecimento", "radiador", "coolant", "aditivo", "ventoinha")),
    ("pneus", ("pneu", "rodizio", "alinhamento", "balanceamento", "calibragem", "roda")),
    ("suspensao", ("suspens", "amortecedor", "bandeja", "pivo", "bieleta", "terminal de direcao")),
    ("eletrica", ("bateria", "alternador", "lampada", "farol", "fusivel")),
    (
        "motor",
        (
            "motor",
            "oleo",
            "vela",
            "correia",
            "valvula",
            "marcha lenta",
            "filtro de ar",
            "combustivel",
            "injec",
            "ignic",
            "bomba d'agua",
            "tbi",
            "corpo de borboleta",
        ),
    ),
]


def _norm(text: str) -> str:
    text = unicodedata.normalize("NFD", text.lower())
    return "".join(c for c in text if unicodedata.category(c) != "Mn")


def guess_region(name: str) -> str:
    n = _norm(name)
    for region, words in _RULES:
        if any(w in n for w in words):
            return region
    return "outros"
