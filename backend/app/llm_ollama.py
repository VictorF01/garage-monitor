"""Sugestões do manual usando um modelo local via Ollama."""

import logging
import os
from pathlib import Path

import httpx
import ollama
from pydantic import ValidationError

from .manual_ai import SYSTEM_PROMPT, ManualAIError
from .pdf_text import chunk_pages, extract_pages, select_maintenance_pages
from .schemas import Suggestion, SuggestionList

log = logging.getLogger(__name__)

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")
# 8k tokens cabe numa GPU de 4 GB com um modelo 3B. Aumente se tiver mais VRAM.
NUM_CTX = int(os.getenv("OLLAMA_NUM_CTX", "8192"))
MAX_PAGES = int(os.getenv("OLLAMA_MAX_PAGES", "24"))
# ~3 caracteres por token em português; sobra espaço para o prompt e a resposta.
CHUNK_CHARS = int(NUM_CTX * 3 * 0.55)


def suggest(pdf_path: Path, vehicle_desc: str) -> list[Suggestion]:
    pages = extract_pages(pdf_path)
    total_chars = sum(len(p.strip()) for p in pages)
    if total_chars < 20 * len(pages):  # quase sem texto: PDF de imagens
        raise ManualAIError(
            "Não consegui extrair texto deste PDF. Ele provavelmente é escaneado (imagens); "
            "OCR ainda não é suportado com o modelo local."
        )

    indices = select_maintenance_pages(pages, MAX_PAGES)
    if not indices:
        raise ManualAIError("Não encontrei páginas com o plano de manutenção neste PDF.")
    chunks = chunk_pages(pages, indices, CHUNK_CHARS)
    log.info("Manual %s: %d páginas, usando %s em %d blocos", pdf_path.name, len(pages),
             [i + 1 for i in indices], len(chunks))

    client = ollama.Client(host=OLLAMA_HOST, timeout=600)
    schema = SuggestionList.model_json_schema()
    results: list[Suggestion] = []
    for n, chunk in enumerate(chunks, 1):
        try:
            response = client.chat(
                model=OLLAMA_MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": f"Veículo: {vehicle_desc}\n\nTrecho do manual (parte {n} de "
                        f"{len(chunks)}):\n\n{chunk}\n\nExtraia os itens do plano de manutenção "
                        "preventiva presentes neste trecho. Se não houver nenhum, devolva uma lista vazia.",
                    },
                ],
                format=schema,
                options={"num_ctx": NUM_CTX, "temperature": 0},
            )
        except (httpx.ConnectError, ConnectionError) as e:
            raise ManualAIError(
                f"Não consegui conectar ao Ollama em {OLLAMA_HOST}. Verifique se ele está rodando "
                "e acessível pelos containers (OLLAMA_HOST=0.0.0.0)."
            ) from e
        except ollama.ResponseError as e:
            if e.status_code == 404:
                raise ManualAIError(
                    f"Modelo '{OLLAMA_MODEL}' não encontrado. Rode: ollama pull {OLLAMA_MODEL}"
                ) from e
            raise ManualAIError(f"Erro do Ollama: {e.error}") from e

        try:
            results.extend(SuggestionList.model_validate_json(response.message.content).suggestions)
        except ValidationError:
            log.warning("Resposta inválida do modelo no bloco %d, ignorando", n)

    return results
