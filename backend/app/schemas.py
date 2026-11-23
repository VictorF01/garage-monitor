from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Kind = Literal["peca", "servico"]
Region = Literal["motor", "arrefecimento", "transmissao", "freios", "pneus", "suspensao", "eletrica", "outros"]


class VehicleIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    brand: str | None = None
    model: str | None = None
    year: int | None = Field(default=None, ge=1900, le=2100)
    current_km: int = Field(default=0, ge=0)


class OdometerIn(BaseModel):
    current_km: int = Field(ge=0)


class VehicleOut(VehicleIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime


class ItemIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    kind: Kind = "servico"
    interval_km: int | None = Field(default=None, gt=0)
    interval_months: int | None = Field(default=None, gt=0)
    notes: str | None = None
    source: Literal["usuario", "manual"] = "usuario"
    # Se não vier, o backend deduz pelo nome (regions.guess_region).
    region: Region | None = None


class RecordIn(BaseModel):
    performed_at: date
    km_at_service: int = Field(ge=0)
    cost: float | None = Field(default=None, ge=0)
    notes: str | None = None


class RecordOut(RecordIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    item_id: int


class ItemOut(ItemIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    vehicle_id: int
    last_record: RecordOut | None = None
    life_percent: float | None = None
    km_remaining: int | None = None
    days_remaining: int | None = None
    status: str
    deleted_at: datetime | None = None


class ManualOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    vehicle_id: int
    filename: str
    size_bytes: int
    uploaded_at: datetime


# ---- Sugestões geradas a partir do manual (também é o schema de saída do Claude) ----


class Suggestion(BaseModel):
    name: str = Field(description="Nome curto da peça ou serviço, em português")
    kind: Kind = Field(description="'peca' para componente físico trocado, 'servico' para serviço/inspeção")
    interval_km: int | None = Field(description="Intervalo em km, ou null se o manual não define")
    interval_months: int | None = Field(description="Intervalo em meses, ou null se o manual não define")
    notes: str | None = Field(description="Observações do manual (condições severas, página, etc.)")


class SuggestionList(BaseModel):
    suggestions: list[Suggestion]
