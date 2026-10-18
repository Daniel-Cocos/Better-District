"""Public dataframe contracts; validation runs at every IO boundary."""

import pandas as pd
import pandera.pandas as pa

from .sources import SOURCES

NONEMPTY = pa.Check.str_length(min_value=1)
CORPUS_SCHEMA = pa.DataFrameSchema(
    {
        "comment_id": pa.Column(str, NONEMPTY, unique=True),
        "dataset_id": pa.Column(str, pa.Check.isin(SOURCES)),
        "policy_domain": pa.Column(str, NONEMPTY),
        "source_file": pa.Column(str, NONEMPTY),
        "source_url": pa.Column(str, NONEMPTY),
        "source_sha256": pa.Column(str, pa.Check.str_matches(r"^[0-9a-f]{64}$")),
        "page_number": pa.Column(int, pa.Check.ge(1)),
        "page_end": pa.Column(int, pa.Check.ge(1)),
        "source_ref": pa.Column(str, nullable=True),
        "extraction_type": pa.Column(
            str,
            pa.Check.isin(
                ["paired_table", "text_block", "shaded_row", "quoted_comment"]
            ),
        ),
        "record_kind": pa.Column(str, pa.Check.isin(["comment", "candidate"])),
        "comment_text": pa.Column(str, NONEMPTY),
        "officer_response": pa.Column(str, NONEMPTY, nullable=True),
        "char_length": pa.Column(int, pa.Check.ge(1)),
        "word_count": pa.Column(int, pa.Check.ge(1)),
    },
    checks=[
        pa.Check(lambda df: df.page_end >= df.page_number, name="page_range"),
        pa.Check(
            lambda df: df.char_length == df.comment_text.str.len(), name="char_length"
        ),
        pa.Check(
            lambda df: df.word_count == df.comment_text.str.split().str.len(),
            name="word_count",
        ),
        pa.Check(
            lambda df: df.apply(
                lambda r: r.policy_domain == SOURCES[r.dataset_id].policy_domain
                and r.source_file == SOURCES[r.dataset_id].filename
                and r.source_url == SOURCES[r.dataset_id].url,
                axis=1,
            ),
            name="source_metadata",
        ),
    ],
    strict=True,
    coerce=True,
)

GROUND_TRUTH_SCHEMA = pa.DataFrameSchema(
    {
        "source_sha256": pa.Column(str, pa.Check.str_matches(r"^[0-9a-f]{64}$")),
        "comment_id": pa.Column(str, NONEMPTY, unique=True),
        "productive": pa.Column(pd.BooleanDtype()),
        "label_quality": pa.Column(
            str, pa.Check.isin(["silver", "reviewed", "ai_reference"])
        ),
        "label_scope": pa.Column(
            str, pa.Check.isin(["constructive_feedback", "licensing_legal_validity"])
        ),
        "label_basis": pa.Column(str, NONEMPTY),
        "evidence": pa.Column(str, NONEMPTY),
        "reviewer": pa.Column(str, NONEMPTY, nullable=True),
    },
    checks=pa.Check(
        lambda df: ~df.label_quality.isin(["reviewed", "ai_reference"])
        | df.reviewer.notna(),
        name="reviewed_labels_require_reviewer",
    ),
    strict=True,
    coerce=True,
)


def empty_frame(schema: pa.DataFrameSchema) -> pd.DataFrame:
    """Construct typed empty frames so empty selections retain their contract."""
    return schema.validate(
        pd.DataFrame(
            {
                name: pd.Series([], dtype=str(col.dtype))
                for name, col in schema.columns.items()
            }
        )
    )
