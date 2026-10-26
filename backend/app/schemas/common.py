from decimal import Decimal
from typing import Annotated, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, PlainSerializer

Money = Annotated[
    Decimal,
    PlainSerializer(
        lambda value: float(value) if value is not None else None,
        return_type=float,
        when_used="json",
    ),
]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int = 1
    size: int = 50
