from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import app.models  # noqa: F401  (registers all models on Base.metadata)
from app.api.routes import (
    accounts,
    auth,
    categories,
    contacts,
    dashboard,
    debts,
    plans,
    transactions,
)
from app.core.config import settings
from app.core.db import Base, engine


@asynccontextmanager
async def lifespan(_: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(
    title=settings.project_name,
    version="1.0.0",
    description="API مدیریت مالی شخصی: حساب‌ها، تراکنش‌ها، وام‌ها، خرید قسطی و قرض‌ها",
    lifespan=lifespan,
)

origins = settings.cors_origins_list
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials="*" not in origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in (
    auth.router,
    accounts.router,
    categories.router,
    contacts.router,
    transactions.router,
    debts.router,
    plans.router,
    dashboard.router,
):
    app.include_router(router, prefix=settings.api_v1_prefix)


@app.get("/", include_in_schema=False)
async def root() -> dict:
    return {"name": settings.project_name, "docs": "/docs"}


@app.get(f"{settings.api_v1_prefix}/health", tags=["health"])
async def health() -> dict:
    return {"status": "ok"}
