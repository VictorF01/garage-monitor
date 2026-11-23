from datetime import date, timedelta

import pytest

from app.life import AVG_DAYS_PER_MONTH, compute_life

TODAY = date(2026, 11, 22)


def life(**kw):
    base = dict(interval_km=None, interval_months=None, last_km=None, last_date=None, current_km=0, today=TODAY)
    return compute_life(**{**base, **kw})


def test_sem_registro_tem_vida_desconhecida():
    r = life(interval_km=10_000, interval_months=12, current_km=50_000)
    assert r == {"life_percent": None, "km_remaining": None, "days_remaining": None, "status": "sem_registro"}


def test_registro_sem_intervalo():
    r = life(last_km=1000, last_date=TODAY, current_km=2000)
    assert r["status"] == "sem_intervalo"
    assert r["life_percent"] is None


def test_recem_trocado_tem_100_por_cento():
    r = life(interval_km=10_000, interval_months=12, last_km=50_000, last_date=TODAY, current_km=50_000)
    assert r["life_percent"] == 100.0
    assert r["km_remaining"] == 10_000
    assert r["status"] == "ok"


def test_so_por_km():
    r = life(interval_km=10_000, last_km=50_000, last_date=TODAY, current_km=57_500)
    assert r["life_percent"] == 25.0
    assert r["km_remaining"] == 2_500
    assert r["days_remaining"] is None


def test_so_por_tempo():
    last = TODAY - timedelta(days=round(6 * AVG_DAYS_PER_MONTH))
    r = life(interval_months=12, last_km=0, last_date=last, current_km=0)
    assert r["life_percent"] == pytest.approx(50.0, abs=0.2)
    assert r["km_remaining"] is None


@pytest.mark.parametrize(
    ("km_used", "days_used", "esperado"),
    [
        (9_000, 30, 10.0),  # km vence primeiro
        (1_000, 330, None),  # tempo vence primeiro (calculado abaixo)
    ],
)
def test_vale_o_que_vencer_primeiro(km_used, days_used, esperado):
    r = life(
        interval_km=10_000,
        interval_months=12,
        last_km=0,
        last_date=TODAY - timedelta(days=days_used),
        current_km=km_used,
    )
    by_km = (1 - km_used / 10_000) * 100
    by_time = (1 - days_used / (12 * AVG_DAYS_PER_MONTH)) * 100
    assert r["life_percent"] == pytest.approx(min(by_km, by_time), abs=0.1)
    if esperado is not None:
        assert r["life_percent"] == esperado


@pytest.mark.parametrize(
    ("current_km", "status"),
    [(57_900, "ok"), (58_000, "atencao"), (59_999, "atencao"), (60_000, "vencido")],
)
def test_faixas_de_status(current_km, status):
    # 20% ou menos = atenção; 0% = vencido
    r = life(interval_km=10_000, last_km=50_000, last_date=TODAY, current_km=current_km)
    assert r["status"] == status


def test_vencido_nao_fica_negativo_e_mostra_km_alem():
    r = life(interval_km=10_000, last_km=50_000, last_date=TODAY, current_km=63_000)
    assert r["life_percent"] == 0.0
    assert r["km_remaining"] == -3_000
    assert r["status"] == "vencido"


def test_hodometro_abaixo_do_ultimo_registro_nao_aumenta_vida():
    # ex.: hodômetro digitado errado, menor que o km da última troca
    r = life(interval_km=10_000, last_km=50_000, last_date=TODAY, current_km=40_000)
    assert r["life_percent"] == 100.0
    assert r["km_remaining"] == 10_000


def test_registro_com_data_futura_conta_como_hoje():
    r = life(interval_months=12, last_km=0, last_date=TODAY + timedelta(days=10), current_km=0)
    assert r["life_percent"] == 100.0
