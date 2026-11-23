from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class Vehicle(Base):
    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    brand: Mapped[str | None] = mapped_column(String(60))
    model: Mapped[str | None] = mapped_column(String(60))
    year: Mapped[int | None] = mapped_column(Integer)
    current_km: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # lixeira (exclusão reversível)

    items: Mapped[list["MaintenanceItem"]] = relationship(
        back_populates="vehicle", cascade="all, delete-orphan", order_by="MaintenanceItem.name"
    )
    manuals: Mapped[list["Manual"]] = relationship(back_populates="vehicle", cascade="all, delete-orphan")


class MaintenanceItem(Base):
    """Uma peça ou serviço acompanhado no carro, com sua vida útil (por km e/ou tempo)."""

    __tablename__ = "maintenance_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(120))
    kind: Mapped[str] = mapped_column(String(20), default="servico")  # "peca" | "servico"
    interval_km: Mapped[int | None] = mapped_column(Integer)
    interval_months: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(20), default="usuario")  # "usuario" | "manual"
    region: Mapped[str] = mapped_column(String(30), default="outros")  # ver regions.py
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # lixeira (exclusão reversível)

    vehicle: Mapped[Vehicle] = relationship(back_populates="items")
    records: Mapped[list["ServiceRecord"]] = relationship(
        back_populates="item",
        cascade="all, delete-orphan",
        order_by="ServiceRecord.performed_at.desc(), ServiceRecord.id.desc()",
    )


class ServiceRecord(Base):
    """Registro de cada vez que a peça foi trocada / o serviço foi feito."""

    __tablename__ = "service_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("maintenance_items.id", ondelete="CASCADE"))
    performed_at: Mapped[date] = mapped_column(Date)
    km_at_service: Mapped[int] = mapped_column(Integer)
    cost: Mapped[float | None] = mapped_column(Numeric(10, 2))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # lixeira (exclusão reversível)

    item: Mapped[MaintenanceItem] = relationship(back_populates="records")


class Manual(Base):
    __tablename__ = "manuals"

    id: Mapped[int] = mapped_column(primary_key=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id", ondelete="CASCADE"))
    filename: Mapped[str] = mapped_column(String(255))
    stored_path: Mapped[str] = mapped_column(String(500))
    size_bytes: Mapped[int] = mapped_column(Integer)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    vehicle: Mapped[Vehicle] = relationship(back_populates="manuals")
