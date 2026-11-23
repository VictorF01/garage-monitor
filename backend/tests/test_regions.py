import pytest

from app.regions import REGIONS, guess_region


@pytest.mark.parametrize(
    ("nome", "regiao"),
    [
        # plano atual do Civic 97
        ("Óleo do motor", "motor"),
        ("Filtro de óleo", "motor"),
        ("Filtro de ar do motor", "motor"),
        ("Velas de ignição", "motor"),
        ("Correia dentada e bomba d'água", "motor"),
        ("Correias auxiliares (inspeção e ajuste)", "motor"),
        ("Folga de válvulas", "motor"),
        ("Marcha lenta", "motor"),
        ("Líquido de arrefecimento", "arrefecimento"),
        ("Fluido da transmissão", "transmissao"),
        ("Fluido de freio", "freios"),
        ("Freios (inspeção)", "freios"),
        ("Freio de estacionamento (ajuste)", "freios"),
        ("Rodízio de pneus", "pneus"),
        # outros casos comuns
        ("Pastilhas dianteiras", "freios"),
        ("Disco de embreagem", "transmissao"),
        ("Óleo do câmbio", "transmissao"),
        ("Amortecedores", "suspensao"),
        ("Bateria", "eletrica"),
        ("Palheta do limpador", "outros"),
    ],
)
def test_guess_region(nome, regiao):
    assert guess_region(nome) == regiao


def test_ignora_acentos_e_maiusculas():
    assert guess_region("RADIADOR") == guess_region("radiador") == "arrefecimento"
    assert guess_region("Câmbio") == "transmissao"


def test_sempre_retorna_regiao_conhecida():
    for nome in ["", "???", "xyz"]:
        assert guess_region(nome) in REGIONS
