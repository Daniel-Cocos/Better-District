"""Request and response models."""

from datetime import date
from typing import Annotated, Literal
from pydantic import AwareDatetime, BaseModel, Field, StringConstraints, model_validator

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


class ChangeVersion(BaseModel):
    version: str


class CommentCreate(BaseModel):
    parent_id: int | None = Field(default=None, gt=0)
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


# ---------- Admin website ----------

Stage = Literal["proposal", "live_trial", "built"]
QuestionType = Literal["single_choice", "multiple_choice", "short_text", "rating"]
Demographic = Literal[
    "age_range", "postcode_area", "gender", "ethnicity", "disability", "connection"
]


class AdminLogin(BaseModel):
    identifier: str = Field(max_length=254)  # username or email address
    password: str = Field(max_length=128)


class Admin(BaseModel):
    email: str
    name: str
    job_title: str


class AdminSession(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    user: Admin


class SiteLocation(BaseModel):
    latitude: float = Field(ge=-90, le=90, allow_inf_nan=False)
    longitude: float = Field(ge=-180, le=180, allow_inf_nan=False)
    radius_m: int = Field(ge=10, le=5000)


class CustomField(BaseModel):
    label: str = Field(max_length=200)
    value: str = Field(max_length=5000)


class Question(BaseModel):
    type: QuestionType
    prompt: str = Field(max_length=500)
    options: list[Annotated[str, Field(max_length=200)]] = Field(
        default=[], max_length=20
    )
    required: bool = False


class EngagementSettings(BaseModel):
    default_questions: bool = True
    custom_comments: bool = True
    comment_replies: bool = True
    demographics: list[Demographic] = []


class ProjectForm(BaseModel):
    """Everything the 5-step wizard collects. Lenient so drafts can be partial."""

    # 1. Basics
    title: str = Field(default="", max_length=200)
    stage: Stage = "proposal"
    feedback_opens: date | None = None
    feedback_closes: date | None = None
    team: str = Field(default="", max_length=200)
    contact: str = Field(default="", max_length=254)
    # 2. Location
    location: SiteLocation | None = None
    ward: str | None = Field(default=None, max_length=100)
    # 3. Documents
    document_ids: list[str] = Field(default=[], max_length=20)
    summary: str = Field(default="", max_length=10000)
    commitments: str = Field(default="", max_length=10000)
    custom_fields: list[CustomField] = Field(default=[], max_length=30)
    # 4. Permanent and changeable
    permanent: list[Annotated[str, Field(max_length=500)]] = Field(
        default=[], max_length=30
    )
    changeable: list[Annotated[str, Field(max_length=500)]] = Field(
        default=[], max_length=30
    )
    # 5. Questions and comments
    questions: list[Question] = Field(default=[], max_length=30)
    engagement: EngagementSettings = EngagementSettings()

    @model_validator(mode="after")
    def feedback_window(self):
        """Reject a feedback window that closes before it opens."""
        if (
            self.feedback_opens
            and self.feedback_closes
            and self.feedback_closes < self.feedback_opens
        ):
            raise ValueError("Feedback must close on or after the day it opens")
        return self

    def publish_problems(self) -> list[str]:
        """What still has to be filled in before residents can see the project."""
        problems = [
            message
            for message, ok in (
                ("Add a title", self.title.strip()),
                ("Name the responsible team", self.team.strip()),
                ("Add a contact", self.contact.strip()),
                ("Place the project on the map", self.location),
                ("Write a summary", self.summary.strip()),
            )
            if not ok
        ]
        for question in self.questions:
            if not question.prompt.strip():
                problems.append("Every question needs some text")
            elif question.type in ("single_choice", "multiple_choice") and (
                len([o for o in question.options if o.strip()]) < 2
            ):
                problems.append(f"“{question.prompt}” needs at least two options")
        return problems


class DraftSummary(BaseModel):
    id: int
    title: str
    updated_at: str


class PublishRequest(ProjectForm):
    draft_id: int | None = None  # deleted once the project is published


class Document(BaseModel):
    id: str
    name: str
    size: int
    content_type: str


class Draft(BaseModel):
    id: int
    form: ProjectForm
    documents: list[Document]
    updated_at: str


class Project(ProjectForm):
    event_id: int
    documents: list[Document]
    created_by: str | None
    created_at: str
    updated_at: str


class AdminEvent(EventDetails):
    """An event as the app shows it, plus what moderators need to see."""

    id: int
    likes: int
    dislikes: int
    closes_at: AwareDatetime | None = None
    comments: int


class OverviewStats(BaseModel):
    events: int
    open_events: int
    comments: int
    likes: int
    dislikes: int
    residents: int  # app accounts; anonymous guests aren't counted


class OverviewComment(BaseModel):
    id: int
    event_id: int
    event_title: str
    body: str
    user_email: str | None
    likes: int
    dislikes: int


class Overview(BaseModel):
    stats: OverviewStats
    recent_comments: list[OverviewComment]
