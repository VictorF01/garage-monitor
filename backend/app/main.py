import os
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, Depends, FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from . import models, schemas
from .db import Base, engine, get_db
from .life import compute_life
from .regions import guess_region

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./uploads"))
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "100"))


@asynccontextmanager
async def lifespan(_: FastAPI):
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    # Versão inicial: cria as tabelas direto. Quando o schema começar a mudar, migrar para Alembic.
    Base.metadata.create_all(engine)
    _migrate()
    yield


def _migrate():
    """Ajustes de schema sem Alembic (ainda). Idempotente: pode rodar a cada start."""
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE maintenance_items ADD COLUMN IF NOT EXISTS region VARCHAR(30)"))
        rows = conn.execute(text("SELECT id, name FROM maintenance_items WHERE region IS NULL")).all()
        for item_id, name in rows:
            conn.execute(
                text("UPDATE maintenance_items SET region = :r WHERE id = :id"),
                {"r": guess_region(name), "id": item_id},
            )


app = FastAPI(title="Garage Monitor", lifespan=lifespan)
api = APIRouter(prefix="/api")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@api.get("/health")
def health():
    return {"status": "ok"}


# ---------------- helpers ----------------


def get_vehicle_or_404(db: Session, vehicle_id: int) -> models.Vehicle:
    vehicle = db.get(models.Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(404, "Veículo não encontrado")
    return vehicle


def get_item_or_404(db: Session, item_id: int) -> models.MaintenanceItem:
    item = db.get(models.MaintenanceItem, item_id)
    if not item:
        raise HTTPException(404, "Item não encontrado")
    return item


def item_out(item: models.MaintenanceItem) -> schemas.ItemOut:
    last = item.records[0] if item.records else None
    life = compute_life(
        interval_km=item.interval_km,
        interval_months=item.interval_months,
        last_km=last.km_at_service if last else None,
        last_date=last.performed_at if last else None,
        current_km=item.vehicle.current_km,
    )
    return schemas.ItemOut(
        id=item.id,
        vehicle_id=item.vehicle_id,
        name=item.name,
        kind=item.kind,
        interval_km=item.interval_km,
        interval_months=item.interval_months,
        notes=item.notes,
        source=item.source,
        region=item.region,
        last_record=schemas.RecordOut.model_validate(last) if last else None,
        **life,
    )


# ---------------- veículos ----------------


@api.get("/vehicles", response_model=list[schemas.VehicleOut])
def list_vehicles(db: Session = Depends(get_db)):
    return db.scalars(select(models.Vehicle).order_by(models.Vehicle.id)).all()


@api.post("/vehicles", response_model=schemas.VehicleOut, status_code=201)
def create_vehicle(data: schemas.VehicleIn, db: Session = Depends(get_db)):
    vehicle = models.Vehicle(**data.model_dump())
    db.add(vehicle)
    db.commit()
    return vehicle


@api.get("/vehicles/{vehicle_id}", response_model=schemas.VehicleOut)
def get_vehicle(vehicle_id: int, db: Session = Depends(get_db)):
    return get_vehicle_or_404(db, vehicle_id)


@api.put("/vehicles/{vehicle_id}", response_model=schemas.VehicleOut)
def update_vehicle(vehicle_id: int, data: schemas.VehicleIn, db: Session = Depends(get_db)):
    vehicle = get_vehicle_or_404(db, vehicle_id)
    for key, value in data.model_dump().items():
        setattr(vehicle, key, value)
    db.commit()
    return vehicle


@api.patch("/vehicles/{vehicle_id}/odometer", response_model=schemas.VehicleOut)
def update_odometer(vehicle_id: int, data: schemas.OdometerIn, db: Session = Depends(get_db)):
    vehicle = get_vehicle_or_404(db, vehicle_id)
    vehicle.current_km = data.current_km
    db.commit()
    return vehicle


@api.delete("/vehicles/{vehicle_id}", status_code=204)
def delete_vehicle(vehicle_id: int, db: Session = Depends(get_db)):
    vehicle = get_vehicle_or_404(db, vehicle_id)
    paths = [Path(m.stored_path) for m in vehicle.manuals]
    db.delete(vehicle)
    db.commit()
    for p in paths:
        p.unlink(missing_ok=True)


# ---------------- itens (peças / serviços) ----------------


@api.get("/vehicles/{vehicle_id}/items", response_model=list[schemas.ItemOut])
def list_items(vehicle_id: int, db: Session = Depends(get_db)):
    vehicle = get_vehicle_or_404(db, vehicle_id)
    items = [item_out(i) for i in vehicle.items]
    # Itens com menor vida útil primeiro; sem registro no final.
    return sorted(items, key=lambda i: (i.life_percent is None, i.life_percent or 0))


@api.post("/vehicles/{vehicle_id}/items", response_model=list[schemas.ItemOut], status_code=201)
def create_items(vehicle_id: int, data: list[schemas.ItemIn], db: Session = Depends(get_db)):
    """Aceita uma lista para permitir adicionar várias sugestões do manual de uma vez."""
    vehicle = get_vehicle_or_404(db, vehicle_id)
    items = [
        models.MaintenanceItem(vehicle=vehicle, **{**d.model_dump(), "region": d.region or guess_region(d.name)})
        for d in data
    ]
    db.add_all(items)
    db.commit()
    return [item_out(i) for i in items]


@api.put("/items/{item_id}", response_model=schemas.ItemOut)
def update_item(item_id: int, data: schemas.ItemIn, db: Session = Depends(get_db)):
    item = get_item_or_404(db, item_id)
    for key, value in data.model_dump().items():
        setattr(item, key, value)
    item.region = data.region or guess_region(data.name)
    db.commit()
    return item_out(item)


@api.delete("/items/{item_id}", status_code=204)
def delete_item(item_id: int, db: Session = Depends(get_db)):
    db.delete(get_item_or_404(db, item_id))
    db.commit()


# ---------------- registros de troca / serviço ----------------


@api.get("/items/{item_id}/records", response_model=list[schemas.RecordOut])
def list_records(item_id: int, db: Session = Depends(get_db)):
    return get_item_or_404(db, item_id).records


@api.post("/items/{item_id}/records", response_model=schemas.ItemOut, status_code=201)
def create_record(item_id: int, data: schemas.RecordIn, db: Session = Depends(get_db)):
    """Registra uma troca/serviço: a vida útil do item volta a 100%."""
    item = get_item_or_404(db, item_id)
    db.add(models.ServiceRecord(item=item, **data.model_dump()))
    # Se o serviço foi feito com km acima do hodômetro atual, atualiza o hodômetro.
    if data.km_at_service > item.vehicle.current_km:
        item.vehicle.current_km = data.km_at_service
    db.commit()
    db.refresh(item)
    return item_out(item)


@api.delete("/records/{record_id}", status_code=204)
def delete_record(record_id: int, db: Session = Depends(get_db)):
    record = db.get(models.ServiceRecord, record_id)
    if not record:
        raise HTTPException(404, "Registro não encontrado")
    db.delete(record)
    db.commit()


# ---------------- manuais ----------------


@api.get("/vehicles/{vehicle_id}/manuals", response_model=list[schemas.ManualOut])
def list_manuals(vehicle_id: int, db: Session = Depends(get_db)):
    return get_vehicle_or_404(db, vehicle_id).manuals


@api.post("/vehicles/{vehicle_id}/manuals", response_model=schemas.ManualOut, status_code=201)
async def upload_manual(vehicle_id: int, file: UploadFile, db: Session = Depends(get_db)):
    vehicle = get_vehicle_or_404(db, vehicle_id)
    if not (await file.read(4)).startswith(b"%PDF"):
        raise HTTPException(400, "Envie o manual em formato PDF")
    await file.seek(0)

    # Grava em blocos para não carregar PDFs grandes inteiros na memória.
    max_bytes = MAX_UPLOAD_MB * 1024 * 1024
    path = UPLOAD_DIR / f"{uuid.uuid4().hex}.pdf"
    size = 0
    with path.open("wb") as out:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > max_bytes:
                out.close()
                path.unlink(missing_ok=True)
                raise HTTPException(413, f"O PDF excede o limite de {MAX_UPLOAD_MB} MB")
            out.write(chunk)

    manual = models.Manual(
        vehicle=vehicle,
        filename=file.filename or "manual.pdf",
        stored_path=str(path),
        size_bytes=size,
    )
    db.add(manual)
    db.commit()
    return manual


@api.delete("/manuals/{manual_id}", status_code=204)
def delete_manual(manual_id: int, db: Session = Depends(get_db)):
    manual = db.get(models.Manual, manual_id)
    if not manual:
        raise HTTPException(404, "Manual não encontrado")
    Path(manual.stored_path).unlink(missing_ok=True)
    db.delete(manual)
    db.commit()


@api.post("/manuals/{manual_id}/suggestions", response_model=list[schemas.Suggestion])
def suggest_items(manual_id: int, db: Session = Depends(get_db)):
    """Lê o manual com o Claude e devolve sugestões (não salva; o usuário escolhe quais aceitar)."""
    from .manual_ai import ManualAIError, suggest_from_manual

    manual = db.get(models.Manual, manual_id)
    if not manual:
        raise HTTPException(404, "Manual não encontrado")
    v = manual.vehicle
    desc = " ".join(str(x) for x in [v.brand, v.model, v.year] if x) or v.name
    try:
        return suggest_from_manual(Path(manual.stored_path), desc)
    except ManualAIError as e:
        raise HTTPException(502, str(e)) from e


app.include_router(api)
