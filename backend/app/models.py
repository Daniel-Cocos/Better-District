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
    under_review: bool = False  # flagged, so hidden from the app until an admin decides


class CommentHistory(Comment):
    event_title: str


class CommentFlagCreate(BaseModel):
    reason: str = Field(default="", max_length=500)


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
    flagged_comments: int


class OverviewComment(BaseModel):
    id: int
    event_id: int
    event_title: str
    body: str
    user_email: str | None
    likes: int
    dislikes: int
    under_review: bool = False


class FlaggedComment(OverviewComment):
    """A comment residents reported, hidden from the app while it waits for a decision."""

    parent_id: int | None
    flags: int
    reasons: list[str]
    first_flagged_at: str


class Overview(BaseModel):
    stats: OverviewStats
    recent_comments: list[OverviewComment]


# The tags residents choose from when they report something; keep in step with
# schema.sql and the app's and website's category lists
IssueCategory = Literal["pothole", "graffiti", "other"]


class CommunityIssue(BaseModel):
    id: int
    title: str
    description: str
    latitude: float
    longitude: float
    status: Literal["submitted", "reviewed", "planned", "resolved"]
    category: IssueCategory = "other"
    created_at: str
    photo_version: int = 1  # changes when the photo is replaced; add it to photo URLs


class IssueEdit(BaseModel):
    title: Text = Field(max_length=200)
    description: Text = Field(max_length=5000)


# ---------- Feedback summaries (admin website) ----------

CommentType = Literal[
    "support", "oppose", "concern", "mixed", "suggestion", "question", "other"
]


class CommentTypeCount(BaseModel):
    type: CommentType
    count: int
    likes: int  # likes those comments received, a rough measure of agreement


class FeedbackTheme(BaseModel):
    label: str
    sentiment: Literal["positive", "negative", "mixed"]
    count: int


Priority = Literal["high", "medium", "low"]
Sentiment = Literal["positive", "negative", "mixed"]


class Pivot(BaseModel):
    """A change the council could make in response to the feedback."""

    action: str
    reason: str
    priority: Priority
    count: int  # comments behind it


class FeedbackAnalysis(BaseModel):
    """What the self-hosted model made of the comments."""

    summary: str
    verdict: Literal["on_track", "adjust", "rethink"] | None = None
    types: list[CommentTypeCount]
    themes: list[FeedbackTheme]
    pivots: list[Pivot] = []
    analysed: int  # comments sent to the model (the most recent, up to a limit)
    classified: int  # of those, how many the model gave a type
    model: str
    generated_at: str
    stale: bool  # comments have changed since this analysis ran


class FeedbackSummary(BaseModel):
    event_id: int
    likes: int
    dislikes: int
    approval: float | None  # likes / (likes + dislikes); None before anyone votes
    comments: int  # visible to residents; comments under review are left out
    comment_likes: int
    comment_dislikes: int
    analysis: FeedbackAnalysis | None


# ---------- Insights page ----------


class Attention(BaseModel):
    level: Literal["low", "medium", "high"]
    reasons: list[str]


class InsightPlan(BaseModel):
    id: int
    title: str
    closes_at: AwareDatetime | None
    is_open: bool
    likes: int
    dislikes: int
    approval: float | None
    comments: int
    analysis: FeedbackAnalysis | None
    attention: Attention


class InsightTotals(BaseModel):
    plans: int
    analysed: int  # plans with a current analysis
    likes: int
    dislikes: int
    approval: float | None
    comments: int
    classified: int  # comments the model has typed, across current analyses
    types: list[CommentTypeCount]
    high_attention: int
    medium_attention: int


class PlanRef(BaseModel):
    event_id: int
    title: str


class BriefingPriority(PlanRef):
    action: str
    why: str
    urgency: Priority


class CrossCutting(BaseModel):
    label: str
    insight: str
    sentiment: Sentiment
    events: list[PlanRef]


class WorkingWell(PlanRef):
    note: str


class Briefing(BaseModel):
    """The model's city-wide reading of every plan's feedback."""

    headline: str
    overview: str
    priorities: list[BriefingPriority]
    cross_cutting: list[CrossCutting]
    working_well: list[WorkingWell]
    model: str
    plans: int  # plans it was based on
    generated_at: str
    stale: bool


class InsightJob(BaseModel):
    running: bool
    done: int
    total: int
    current: str | None  # what it's working on now
    error: str | None
    failed: int


class Insights(BaseModel):
    plans: list[InsightPlan]
    totals: InsightTotals
    briefing: Briefing | None
    job: InsightJob
    pending: int  # plans whose analysis is missing or out of date


# ---------- Reports gallery (admin website) ----------


class Severity(BaseModel):
    """The self-hosted model's estimate of how urgent a report is."""

    level: Literal[1, 2, 3]  # 3 is the most severe
    reason: str
    model: str
    saw_photo: (
        bool  # False when no vision model was available, so it read the text alone
    )
    generated_at: str


class Report(CommunityIssue):
    severity: Severity | None


class Reports(BaseModel):
    reports: list[Report]
    job: InsightJob
    pending: int  # reports the model hasn't assessed yet
    folder: str  # where photos can be dropped to add them as reports
    skipped: list[str]  # files in that folder that couldn't be read as photos
