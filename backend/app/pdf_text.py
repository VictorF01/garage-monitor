"""Extração de texto do PDF e seleção das páginas que falam de manutenção.

Modelos locais têm contexto pequeno, então não dá para mandar um manual inteiro
de centenas de páginas. Pontuamos cada página por palavras-chave do plano de
manutenção e mandamos só as mais relevantes.
"""

import re
import unicodedata
from pathlib import Path

import pymupdf

KEYWORDS = [
    # português
    "manutencao", "revisao", "revisoes", "plano de manutencao", "manutencao preventiva",
    "substituir", "substituicao", "trocar", "troca", "inspecionar", "inspecao",
    "oleo", "filtro", "fluido", "correia", "vela", "pastilha", "arrefecimento",
    "uso severo", "o que ocorrer primeiro", "intervalo",
    # inglês (muitos manuais de oficina só existem em inglês)
    "maintenance", "schedule", "replace", "inspect", "every", "whichever comes first",
    "normal conditions", "severe conditions", "oil", "filter", "fluid", "belt",
    "spark plug", "coolant", "brake pad", "interval",
]
# Intervalos explícitos ("a cada 10.000 km", "every 7,500 miles (12,000 km)") pesam mais.
KM_RE = re.compile(r"\d{1,3}(?:[.,\s]\d{3})+\s*(?:km|miles)|\d+\s*mil\s*km|\b\d{4,6}\s*(?:km|miles)", re.I)
MONTHS_RE = re.compile(r"\b\d{1,3}\s*(?:meses|months)\b", re.I)


def _norm(text: str) -> str:
    text = unicodedata.normalize("NFD", text.lower())
    return "".join(c for c in text if unicodedata.category(c) != "Mn")


def extract_pages(pdf_path: Path) -> list[str]:
    # PyMuPDF tolera PDFs malformados (comum em manuais de fabricantes) melhor que pypdf.
    with pymupdf.open(pdf_path) as doc:
        pages = []
        for page in doc:
            try:
                pages.append(page.get_text())
            except Exception:  # páginas corrompidas não devem derrubar a análise
                pages.append("")
        return pages


def score_page(text: str) -> float:
    norm = _norm(text)
    score = sum(norm.count(k) for k in KEYWORDS)
    # Tabelas de revisão têm muitas menções a km e meses: peso maior.
    score += 3 * len(KM_RE.findall(text)) + 2 * len(MONTHS_RE.findall(text))
    return score


def select_maintenance_pages(pages: list[str], max_pages: int, min_score: float = 8) -> list[int]:
    """Índices (0-based) das páginas mais relevantes, em ordem de leitura."""
    scored = [(score_page(t), i) for i, t in enumerate(pages) if t.strip()]
    best = sorted((s for s in scored if s[0] >= min_score), reverse=True)[:max_pages]
    return sorted(i for _, i in best)


def chunk_pages(pages: list[str], indices: list[int], max_chars: int) -> list[str]:
    """Agrupa páginas em blocos de até max_chars, marcando o número de cada página."""
    chunks, current = [], ""
    for i in indices:
        text = re.sub(r"[ \t]+", " ", pages[i]).strip()[:max_chars]
        block = f"--- Página {i + 1} ---\n{text}\n"
        if current and len(current) + len(block) > max_chars:
            chunks.append(current)
            current = ""
        current += block
    if current:
        chunks.append(current)
    return chunks
