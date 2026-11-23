"""Cálculo da vida útil restante de uma peça/serviço."""

from datetime import date

AVG_DAYS_PER_MONTH = 30.44


def compute_life(
    *,
    interval_km: int | None,
    interval_months: int | None,
    last_km: int | None,
    last_date: date | None,
    current_km: int,
    today: date | None = None,
) -> dict:
    """Retorna a vida útil restante (0-100%) e o que falta em km/dias.

    A vida útil é o menor valor entre o critério de km e o de tempo
    ("o que vencer primeiro"), como nos manuais de fabricantes.
    Sem registro de troca, a vida é desconhecida (None).
    """
    today = today or date.today()
    result = {
        "life_percent": None,
        "km_remaining": None,
        "days_remaining": None,
        "status": "sem_registro",
    }
    if last_date is None or last_km is None:
        return result

    fractions = []
    if interval_km:
        used_km = max(current_km - last_km, 0)
        fractions.append(used_km / interval_km)
        result["km_remaining"] = interval_km - used_km
    if interval_months:
        total_days = interval_months * AVG_DAYS_PER_MONTH
        used_days = max((today - last_date).days, 0)
        fractions.append(used_days / total_days)
        result["days_remaining"] = round(total_days - used_days)

    if not fractions:
        result["status"] = "sem_intervalo"
        return result

    life = max(0.0, min(100.0, (1 - max(fractions)) * 100))
    result["life_percent"] = round(life, 1)
    if life <= 0:
        result["status"] = "vencido"
    elif life <= 20:
        result["status"] = "atencao"
    else:
        result["status"] = "ok"
    return result
