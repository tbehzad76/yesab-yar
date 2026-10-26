"""اصلاحات سبک و idempotent روی اسکیمای دیتابیس.

این پروژه از Alembic استفاده نمی‌کند و جدول‌ها با create_all ساخته می‌شوند؛
پس تغییری که create_all اعمال نمی‌کند (مثل nullable) اینجا و در هر استارت
به‌صورت بی‌خطر اجرا می‌شود.
"""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

SCHEMA_FIXES: tuple[str, ...] = (
    "ALTER TABLE debts ALTER COLUMN due_date DROP NOT NULL",
)


async def apply_schema_fixes(conn: AsyncConnection, dialect: str) -> None:
    if dialect != "postgresql":
        return
    for statement in SCHEMA_FIXES:
        await conn.execute(text(statement))
