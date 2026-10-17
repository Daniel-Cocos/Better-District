"""Request and response models."""

from typing import Annotated, Literal
from pydantic import AwareDatetime, BaseModel, Field, StringConstraints

Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
Email = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        to_lower=True,
        max_length=254,
        pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$",
    ),
]


class EventDetails(BaseModel):
    title: Text = Field(max_length=200)
    description: Text = Field(max_length=10000)
    latitude: float = Field(ge=-90, le=90, allow_inf_nan=False)
    longitude: float = Field(ge=-180, le=180, allow_inf_nan=False)


class EventCreate(EventDetails):
    closes_at: AwareDatetime


class Event(EventDetails):
    id: int
    likes: int
    dislikes: int
    closes_at: AwareDatetime | None = None
    my_vote: Literal[-1, 0, 1] = 0


class CommentCreate(BaseModel):
    body: Text = Field(max_length=5000)


class Comment(CommentCreate):
    id: int
    event_id: int
    user_email: str | None
    likes: int
    dislikes: int
    my_vote: Literal[-1, 0, 1] = 0
    is_mine: bool = False


class CommentHistory(Comment):
    event_title: str


class VoteCreate(BaseModel):
    vote: Literal[-1, 0, 1]


class UserCreate(BaseModel):
    email: Email
    password: str = Field(min_length=8, max_length=128)


class User(BaseModel):
    email: str
