"""Sugestões do manual usando o Claude (API da Anthropic)."""

import os
from pathlib import Path

import anthropic

from .manual_ai import SYSTEM_PROMPT, ManualAIError
from .schemas import Suggestion, SuggestionList

MODEL = "claude-opus-5-5"
# O PDF é enviado pela Files API (até 500 MB por arquivo), que evita o limite de
# 32 MB por requisição do envio em base64. O limite de 600 páginas por documento continua.


def suggest(pdf_path: Path, vehicle_desc: str) -> list[Suggestion]:
    if not os.getenv("ANTHROPIC_API_KEY"):
        raise ManualAIError(
            "ANTHROPIC_API_KEY não configurada. Defina a chave no arquivo .env e reinicie o backend."
        )
    client = anthropic.Anthropic()
    uploaded = None
    try:
        uploaded = client.files.upload(file=(pdf_path.name, pdf_path.read_bytes(), "application/pdf"))
        # Streaming evita timeout HTTP em manuais longos.
        with client.beta.messages.stream(
            model=MODEL,
            max_tokens=32000,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            thinking={"type": "adaptive"},
            output_config={"effort": "medium"},
            system=SYSTEM_PROMPT,
            output_format=SuggestionList,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "document",
                            "source": {"type": "file", "file_id": uploaded.id},
                        },
                        {
                            "type": "text",
                            "text": f"Veículo: {vehicle_desc}\n\n"
                            "Extraia o plano de manutenção preventiva deste manual.",
                        },
                    ],
                }
            ],
        ) as stream:
            response = stream.get_final_message()
    except anthropic.AuthenticationError as e:
        raise ManualAIError("ANTHROPIC_API_KEY inválida ou não configurada.") from e
    except anthropic.RateLimitError as e:
        raise ManualAIError("Limite de requisições atingido. Tente novamente em instantes.") from e
    except anthropic.BadRequestError as e:
        raise ManualAIError(
            f"O manual não pôde ser processado (o limite é 600 páginas por PDF): {e.message}"
        ) from e
    except anthropic.APIStatusError as e:
        raise ManualAIError(f"Erro na API do Claude ({e.status_code}).") from e
    except anthropic.APIConnectionError as e:
        raise ManualAIError("Falha de conexão com a API do Claude.") from e
    finally:
        # O arquivo só é necessário durante a análise; o original fica no volume local.
        if uploaded is not None:
            try:
                client.files.delete(uploaded.id)
            except anthropic.APIError:
                pass

    if response.stop_reason == "refusal":
        raise ManualAIError("O modelo recusou processar este documento.")
    if response.stop_reason == "max_tokens":
        raise ManualAIError("A resposta ficou longa demais. Envie só o capítulo de manutenção.")
    if response.parsed_output is None:
        raise ManualAIError("Não foi possível interpretar a resposta do modelo.")
    return response.parsed_output.suggestions
