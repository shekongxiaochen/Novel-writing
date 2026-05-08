from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class EmailCodeSendIn(BaseModel):
    email: str
    purpose: str = "register"


class RegisterIn(BaseModel):
    email: str
    password: str = Field(min_length=6, max_length=128)
    code: str = Field(min_length=4, max_length=12)
    display_name: str = Field(default="", max_length=120)


class LoginIn(BaseModel):
    email: str
    password: str = Field(min_length=6, max_length=128)


class UserOut(BaseModel):
    id: str
    email: str
    display_name: str
    created_at: datetime


class AuthOut(BaseModel):
    token: str
    expires_at: datetime
    user: UserOut


class NovelBase(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    summary: str = ""
    genre: str = ""
    perspective: str = ""
    tone: str = ""
    is_multi_line_narrative: bool = False


class NovelCreateIn(NovelBase):
    pass


class NovelUpdateIn(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    summary: str | None = None
    genre: str | None = None
    perspective: str | None = None
    tone: str | None = None
    is_multi_line_narrative: bool | None = None


class NovelOut(NovelBase):
    id: str
    created_at: datetime
    updated_at: datetime


class SnapshotPutIn(BaseModel):
    payload: dict[str, Any]


class SnapshotOut(BaseModel):
    novel_id: str
    version: int
    payload: dict[str, Any]
    updated_at: datetime


class MessageOut(BaseModel):
    message: str


class OutlineAiExpandIn(BaseModel):
    title: str = Field(default="", max_length=120)
    summary: str = Field(default="", max_length=500)
    goal: str = Field(default="", max_length=500)
    conflict: str = Field(default="", max_length=500)
    twist: str = Field(default="", max_length=500)
    result: str = Field(default="", max_length=500)
    suspense: str = Field(default="", max_length=500)
    mode: str = Field(default="full", pattern="^(full|conflict|twist|suspense)$")


class OutlineAiExpandOut(BaseModel):
    conflict: str = ""
    twist: str = ""
    suspense: str = ""

