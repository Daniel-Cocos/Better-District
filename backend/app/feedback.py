"""Comment analysis for the admin website, run on a self-hosted Ollama server.

Comments never leave the council's own machines: the model runs on the Ollama host set by
OLLAMA_URL (by default the team's GPU PC on Tailscale), and Ollama "cloud" models are refused.
Two kinds of result are cached and only recomputed when their input changes:
- per event: comment types, themes, a summary, a verdict and recommended changes ("pivots")
- city-wide: a briefing for the council that reads across every event's analysis
"""

import hashlib
import json
import os
import sqlite3
import threading
import urllib.error
import urllib.request
from collections import defaultdict
from typing import get_args

from app.models import CommentType

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://100.100.79.70:11434").rstrip("/")
# Unset: use the first local model the server has installed
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "")
OLLAMA_TIMEOUT = float(os.environ.get("OLLAMA_TIMEOUT", "300"))

# Bump when the prompts or result shape change, so cached results are redone
ANALYSIS_VERSION = "2"
# The same for the city-wide briefing alone, so its prompt can change without redoing every plan
BRIEFING_VERSION = "3"

# Keep prompts within a small local model's context window
MAX_COMMENTS = 150
MAX_COMMENT_CHARS = 600
MAX_THEMES = 6
MAX_PIVOTS = 4
MAX_PRIORITIES = 6
MAX_CROSS_CUTTING = 5
MAX_WORKING_WELL = 3
COMMENT_TYPES: tuple[str, ...] = get_args(CommentType)
SENTIMENTS = ("positive", "negative", "mixed")
PRIORITIES = ("high", "medium", "low")
VERDICTS = ("on_track", "adjust", "rethink")

SYSTEM_PROMPT = f"""You analyse residents' comments on a Southampton City Council consultation.
Classify every comment by its "n" number into exactly one type:
- support: in favour of the proposal
- oppose: explicitly against the proposal going ahead
- concern: raises a worry, risk or unanswered problem without rejecting the proposal
- mixed: clearly both for and against, or support only on a condition
- suggestion: proposes a specific change, addition or alternative
- question: mainly asks for information
- other: off-topic, or general remarks about the council rather than this proposal
Group comments into at most {MAX_THEMES} themes. A theme is a TOPIC residents talk about
(such as "Pavement damage", "Maintenance", "Cost", "Parking", "Fairness between areas"), never a
stance like "Support" or "Suggestions". Prefer themes shared by two or more comments; plain
"great idea" comments with no topic need no theme. Give each theme's overall sentiment and the
"n" numbers of its comments.
Write "summary": 2 to 4 plain-English sentences for council officers on what residents think
overall, the main concerns and the main points of support.
Give a "verdict" on the plan as residents see it: "on_track" (broadly welcomed, carry on),
"adjust" (supported, but real concerns need changes or answers) or "rethink" (substantial
opposition; the plan needs reconsidering).
List up to {MAX_PIVOTS} "pivots": concrete things the council should change, add, address or
explain because of this feedback, most important first. Each has a short imperative "action"
(e.g. "Publish a maintenance plan for new trees"), a one-sentence "reason" grounded in what
residents said, a "priority" (high, medium or low) and the "n" numbers of the comments behind it.
Only suggest pivots residents actually asked for or that answer their concerns.
Comments with many likes reflect wider agreement. Be neutral and factual; never quote
email addresses. Answer with JSON only."""

RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "verdict": {"type": "string", "enum": list(VERDICTS)},
        "comments": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "n": {"type": "integer"},
                    "type": {"type": "string", "enum": list(COMMENT_TYPES)},
                },
                "required": ["n", "type"],
            },
        },
        "themes": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "label": {"type": "string"},
                    "sentiment": {"type": "string", "enum": list(SENTIMENTS)},
                    "comments": {"type": "array", "items": {"type": "integer"}},
                },
                "required": ["label", "sentiment", "comments"],
            },
        },
        "pivots": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "action": {"type": "string"},
                    "reason": {"type": "string"},
                    "priority": {"type": "string", "enum": list(PRIORITIES)},
                    "comments": {"type": "array", "items": {"type": "integer"}},
                },
                "required": ["action", "reason", "priority", "comments"],
            },
        },
    },
    "required": ["summary", "verdict", "comments", "themes", "pivots"],
}

BRIEFING_PROMPT = f"""You advise Southampton City Council officers. You are given analyses of
residents' feedback on each of the council's current plans (each with an "id"). Write a briefing
that tells the council where to change course.
- "headline": one sentence of at most 25 words, the single most important message.
- "overview": 3 to 5 plain-English sentences on overall resident sentiment across the plans.
- "priorities": up to {MAX_PRIORITIES} plans where the council should act or pivot, most urgent
  first. Each names the plan "id", an imperative "action" and a one-sentence "why" grounded in the
  feedback, and an "urgency" (high, medium or low). Favour plans with low approval, many concerns
  or objections, or a "rethink" verdict, and open plans over closed ones.
- "cross_cutting": up to {MAX_CROSS_CUTTING} issues that come up across several plans (such as
  "Parking", "Consultation quality", "Maintenance"), each with a "label", a one-sentence
  "insight", its overall "sentiment" and the "ids" of the plans where it appears.
- "working_well": up to {MAX_WORKING_WELL} plans residents clearly welcome, each with the plan
  "id" and a short "note" on why, so the council can build on them.
Only use plan ids you were given. Be neutral, factual and specific. Answer with JSON only."""

BRIEFING_SCHEMA = {
    "type": "object",
    "properties": {
        "headline": {"type": "string"},
        "overview": {"type": "string"},
        "priorities": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "integer"},
                    "action": {"type": "string"},
                    "why": {"type": "string"},
                    "urgency": {"type": "string", "enum": list(PRIORITIES)},
                },
                "required": ["id", "action", "why", "urgency"],
            },
        },
        "cross_cutting": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "label": {"type": "string"},
                    "insight": {"type": "string"},
                    "sentiment": {"type": "string", "enum": list(SENTIMENTS)},
                    "ids": {"type": "array", "items": {"type": "integer"}},
                },
                "required": ["label", "insight", "sentiment", "ids"],
            },
        },
        "working_well": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"id": {"type": "integer"}, "note": {"type": "string"}},
                "required": ["id", "note"],
            },
        },
    },
    "required": ["headline", "overview", "priorities", "cross_cutting", "working_well"],
}


class AnalysisUnavailable(Exception):
    """The Ollama server couldn't be reached or gave an unusable answer."""


# ---------- Talking to Ollama ----------


def _request(path: str, body: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(
        f"{OLLAMA_URL}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST" if data else "GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=OLLAMA_TIMEOUT) as response:
            return json.loads(response.read())
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        raise AnalysisUnavailable(
            f"Couldn’t reach the analysis server at {OLLAMA_URL}"
        ) from error
    except json.JSONDecodeError as error:
        raise AnalysisUnavailable(
            "The analysis server sent an unreadable reply"
        ) from error


def is_local(model: dict) -> bool:
    """Ollama "cloud" models forward prompts to ollama.com, so residents' comments
    would leave council machines; only models that run on the server itself are used."""
    return not model.get("remote_host") and not model["name"].endswith(
        (":cloud", "-cloud")
    )


def pick_model() -> str:
    """The configured model, or the first local one installed on the server."""
    models = _request("/api/tags").get("models") or []
    if OLLAMA_MODEL:
        chosen = next((m for m in models if m["name"] == OLLAMA_MODEL), None)
        if chosen is None:
            raise AnalysisUnavailable(f"{OLLAMA_MODEL} isn’t installed on {OLLAMA_URL}")
        if not is_local(chosen):
            raise AnalysisUnavailable(
                f"{OLLAMA_MODEL} is a cloud model; choose one that runs locally"
            )
        return OLLAMA_MODEL
    local = [m["name"] for m in models if is_local(m)]
    if not local:
        raise AnalysisUnavailable(f"No local models are installed on {OLLAMA_URL}")
    return local[0]


def ask_model(
    model: str, prompt: str, system: str = SYSTEM_PROMPT, schema: dict | None = None
) -> dict:
    """One structured chat call; Ollama constrains the output to the JSON schema."""
    reply = _request(
        "/api/chat",
        {
            "model": model,
            "stream": False,
            "format": schema or RESPONSE_SCHEMA,
            # Room for ~150 comments; skip "thinking" on models that do it, it's slow here
            "options": {"temperature": 0, "num_ctx": 32768},
            "think": False,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
        },
    )
    if "error" in reply:
        raise AnalysisUnavailable(f"The analysis server said: {reply['error']}")
    try:
        result = json.loads(reply["message"]["content"])
    except (KeyError, TypeError, json.JSONDecodeError) as error:
        raise AnalysisUnavailable("The model didn’t return valid JSON") from error
    if not isinstance(result, dict):
        raise AnalysisUnavailable("The model didn’t return valid JSON")
    return result


# ---------- One event ----------


def visible_comments(database: sqlite3.Connection, event_id: int) -> list[dict]:
    """What residents can see: comments under review are left out of the analysis."""
    return [
        dict(row)
        for row in database.execute(
            "SELECT id, body, likes, dislikes FROM comments "
            "WHERE event_id = ? AND status != 'flagged' ORDER BY id",
            (event_id,),
        )
    ]


def fingerprint(event: dict, comments: list[dict]) -> str:
    """Changes whenever the text being analysed does (votes alone don't need a new run)."""
    content = json.dumps(
        [
            ANALYSIS_VERSION,
            event["title"],
            event["description"],
            [(c["id"], c["body"]) for c in comments],
        ]
    )
    return hashlib.sha256(content.encode()).hexdigest()


def build_prompt(event: dict, comments: list[dict]) -> str:
    """The event and its numbered comments; the model refers to comments by number."""
    lines = [
        f"Proposal: {event['title']}",
        f"Description: {event['description'][:2000]}",
        "",
        "Comments:",
    ]
    for n, comment in enumerate(comments, start=1):
        body = " ".join(comment["body"].split())[:MAX_COMMENT_CHARS]
        lines.append(
            f"n={n} (likes {comment['likes']}, dislikes {comment['dislikes']}): {body}"
        )
    return "\n".join(lines)


def _numbers(values, limit: int) -> set[int]:
    """Valid comment numbers (1..limit) from a model-supplied list."""
    return {n for n in values or [] if isinstance(n, int) and 1 <= n <= limit}


def _text(value, limit: int) -> str:
    return " ".join(str(value or "").split())[:limit]


def tally(comments: list[dict], result: dict) -> dict:
    """Count types, themes and pivots ourselves from the model's per-comment numbers,
    so totals always add up even when a small model miscounts."""
    labels: dict[int, str] = {}
    for item in result.get("comments") or []:
        if not isinstance(item, dict):
            continue
        n, kind = item.get("n"), item.get("type")
        if isinstance(n, int) and 1 <= n <= len(comments) and kind in COMMENT_TYPES:
            labels.setdefault(n, kind)

    counts: dict[str, dict[str, int]] = defaultdict(lambda: {"count": 0, "likes": 0})
    for n, kind in labels.items():
        counts[kind]["count"] += 1
        counts[kind]["likes"] += comments[n - 1]["likes"]
    types = [{"type": kind, **counts[kind]} for kind in COMMENT_TYPES if kind in counts]

    themes = []
    for theme in result.get("themes") or []:
        if not isinstance(theme, dict) or not _text(theme.get("label"), 60):
            continue
        members = _numbers(theme.get("comments"), len(comments))
        if members:
            themes.append(
                {
                    "label": _text(theme["label"], 60),
                    "sentiment": (
                        theme.get("sentiment")
                        if theme.get("sentiment") in SENTIMENTS
                        else "mixed"
                    ),
                    "count": len(members),
                }
            )
    themes.sort(key=lambda t: -t["count"])

    pivots = []
    for pivot in result.get("pivots") or []:
        if not isinstance(pivot, dict) or not _text(pivot.get("action"), 160):
            continue
        pivots.append(
            {
                "action": _text(pivot["action"], 160),
                "reason": _text(pivot.get("reason"), 400),
                "priority": (
                    pivot.get("priority")
                    if pivot.get("priority") in PRIORITIES
                    else "medium"
                ),
                "count": len(_numbers(pivot.get("comments"), len(comments))),
            }
        )
    # Stable sort keeps the model's own order within each priority
    pivots.sort(key=lambda p: PRIORITIES.index(p["priority"]))

    verdict = result.get("verdict")
    return {
        "summary": _text(result.get("summary"), 2000),
        "verdict": verdict if verdict in VERDICTS else None,
        "types": types,
        "themes": themes[:MAX_THEMES],
        "pivots": pivots[:MAX_PIVOTS],
        "classified": len(labels),
    }


def analyse(event: dict, comments: list[dict]) -> dict:
    """Run the model over the most recent comments and return the tallied result."""
    sample = comments[-MAX_COMMENTS:]
    model = pick_model()
    result = tally(sample, ask_model(model, build_prompt(event, sample)))
    return {**result, "model": model, "analysed": len(sample)}


def cached_analysis(
    database: sqlite3.Connection, event: dict, comments: list[dict]
) -> dict | None:
    """The stored analysis, marked stale if the comments have changed since."""
    if not comments:
        return None
    cached = database.execute(
        "SELECT * FROM feedback_analyses WHERE event_id = ?", (event["id"],)
    ).fetchone()
    if cached is None:
        return None
    return {
        **json.loads(cached["result_json"]),
        "generated_at": cached["created_at"],
        "stale": cached["fingerprint"] != fingerprint(event, comments),
    }


# One analysis per event at a time, so repeated requests wait for the first run's result
_locks: dict[int, threading.Lock] = defaultdict(threading.Lock)


def analysis_lock(event_id: int) -> threading.Lock:
    """Held while an event is analysed, by requests and the background job alike."""
    return _locks[event_id]


def ensure_analysis(
    database: sqlite3.Connection, event_id: int, force: bool = False
) -> bool:
    """Analyse an event unless its cached result is current. Returns whether the model ran.

    Raises AnalysisUnavailable if the model can't be used, LookupError if the event is gone.
    """
    with analysis_lock(event_id):
        row = database.execute(
            "SELECT * FROM events WHERE id = ?", (event_id,)
        ).fetchone()
        if row is None:
            raise LookupError(event_id)
        event = dict(row)
        comments = visible_comments(database, event_id)
        current = cached_analysis(database, event, comments)
        if not comments or (current and not current["stale"] and not force):
            return False
        result = analyse(event, comments)
        database.execute(
            "INSERT INTO feedback_analyses (event_id, fingerprint, result_json) "
            "VALUES (?, ?, ?) ON CONFLICT (event_id) DO UPDATE SET "
            "fingerprint = excluded.fingerprint, result_json = excluded.result_json, "
            "created_at = CURRENT_TIMESTAMP",
            (event_id, fingerprint(event, comments), json.dumps(result)),
        )
        # Commit before releasing the lock, so a waiting request sees this result
        database.commit()
        return True


def attention(approval: float | None, votes: int, analysis: dict | None) -> dict:
    """How urgently a plan needs the council's attention, with the reasons in words.

    Deliberately simple and explainable: low approval, a high share of objections and
    concerns, or a "rethink" verdict from the model. Small samples are ignored.
    """
    reasons: list[tuple[int, str]] = []  # (level, reason): 2 high, 1 medium
    if approval is not None and votes >= 10:
        if approval < 0.4:
            reasons.append((2, f"Only {round(approval * 100)}% of votes approve"))
        elif approval < 0.6:
            reasons.append((1, f"Votes are split: {round(approval * 100)}% approve"))
    if analysis:
        objecting = sum(
            t["count"] for t in analysis["types"] if t["type"] in ("oppose", "concern")
        )
        if analysis["classified"] >= 5 and objecting:
            share = objecting / analysis["classified"]
            if share >= 0.3:
                reasons.append(
                    (
                        2 if share >= 0.5 else 1,
                        f"{round(share * 100)}% of comments object or raise concerns",
                    )
                )
        # The model says "adjust" for most plans, so only its strongest verdict counts
        if analysis.get("verdict") == "rethink":
            reasons.append((2, "Residents’ feedback suggests rethinking the plan"))
    level = max((lvl for lvl, _ in reasons), default=0)
    reasons.sort(key=lambda r: -r[0])
    return {
        "level": ("low", "medium", "high")[level],
        "reasons": [text for _, text in reasons],
    }


# ---------- City-wide briefing ----------


def briefing_fingerprint(items: list[dict]) -> str:
    """Changes when any plan's analysis does; votes alone don't need a new briefing."""
    content = json.dumps(
        [BRIEFING_VERSION, sorted((i["id"], i["fingerprint"]) for i in items)]
    )
    return hashlib.sha256(content.encode()).hexdigest()


def build_briefing_prompt(items: list[dict]) -> str:
    """One compact block per analysed plan."""
    blocks = []
    for item in items:
        analysis = item["analysis"]
        types = ", ".join(f"{t['type']} {t['count']}" for t in analysis["types"])
        pivots = "; ".join(p["action"] for p in analysis.get("pivots") or [])
        themes = ", ".join(
            f"{t['label']} ({t['sentiment']})" for t in analysis["themes"]
        )
        approval = (
            f"{round(item['approval'] * 100)}% of {item['votes']} votes approve"
            if item["approval"] is not None
            else "no votes"
        )
        blocks.append(
            f"id={item['id']} | {item['title']} | {'open' if item['is_open'] else 'closed'}"
            f" | {approval} | {item['comments']} comments ({types})"
            f" | verdict: {analysis.get('verdict') or 'unknown'}\n"
            f"Summary: {analysis['summary']}\nThemes: {themes or 'none'}\n"
            f"Suggested changes: {pivots or 'none'}"
        )
    return "Plans:\n\n" + "\n\n".join(blocks)


def tally_briefing(result: dict, titles: dict[int, str]) -> dict:
    """Keep only references to real plans, and attach their titles."""

    def plan(item, key="id"):
        return isinstance(item, dict) and item.get(key) in titles

    seen: set[int] = set()
    priorities = []
    for item in result.get("priorities") or []:
        if plan(item) and item["id"] not in seen and _text(item.get("action"), 160):
            seen.add(item["id"])
            priorities.append(
                {
                    "event_id": item["id"],
                    "title": titles[item["id"]],
                    "action": _text(item["action"], 160),
                    "why": _text(item.get("why"), 400),
                    "urgency": (
                        item.get("urgency")
                        if item.get("urgency") in PRIORITIES
                        else "medium"
                    ),
                }
            )
    cross_cutting = []
    for item in result.get("cross_cutting") or []:
        if not isinstance(item, dict) or not _text(item.get("label"), 60):
            continue
        ids = sorted({i for i in item.get("ids") or [] if i in titles})
        cross_cutting.append(
            {
                "label": _text(item["label"], 60),
                "insight": _text(item.get("insight"), 400),
                "sentiment": (
                    item.get("sentiment")
                    if item.get("sentiment") in SENTIMENTS
                    else "mixed"
                ),
                "events": [{"event_id": i, "title": titles[i]} for i in ids],
            }
        )
    working_well = [
        {
            "event_id": item["id"],
            "title": titles[item["id"]],
            "note": _text(item.get("note"), 300),
        }
        for item in result.get("working_well") or []
        if plan(item)
    ]
    return {
        "headline": _text(result.get("headline"), 300),
        "overview": _text(result.get("overview"), 2000),
        "priorities": priorities[:MAX_PRIORITIES],
        "cross_cutting": cross_cutting[:MAX_CROSS_CUTTING],
        "working_well": working_well[:MAX_WORKING_WELL],
    }


def write_briefing(items: list[dict]) -> dict:
    """Ask the model for the city-wide briefing over the analysed plans."""
    model = pick_model()
    result = ask_model(
        model, build_briefing_prompt(items), BRIEFING_PROMPT, BRIEFING_SCHEMA
    )
    titles = {item["id"]: item["title"] for item in items}
    return {**tally_briefing(result, titles), "model": model, "plans": len(items)}
