"""Versioned definition shared by reference labels and model instructions."""

RUBRIC_VERSION = "productivity-v1.0"
PROMPT_RUBRIC = (
    "Productive feedback contains at least one relevant, identifiable issue, "
    "reason, impact, experience, or suggestion that can inform a consultation "
    "decision. A short comment can qualify. A specific claimed consequence is "
    "enough; do not require statistics or a solution. Disagreement, anger, "
    "spelling errors and criticism do not make a comment unproductive. "
    "A useful point within a rant makes the whole comment productive. Bare "
    "approval or opposition, unsupported abuse, and unrelated content with no "
    "relevant usable point are unproductive. Do not assess whether an "
    "allegation is factually correct, a proposal is feasible, or an objection "
    "is legally valid. Judge the comment itself, not any council response."
)
