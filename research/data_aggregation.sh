#!/usr/bin/env bash
set -euo pipefail

# Configuration
DATA_DIR="./southampton_consultation_data"
RAW_PDF_DIR="${DATA_DIR}/raw_pdfs"
VENV_DIR="${DATA_DIR}/.venv"
OUTPUT_CSV="${DATA_DIR}/southampton_consultations_aggregated.csv"
OUTPUT_PARQUET="${DATA_DIR}/southampton_consultations_aggregated.parquet"

mkdir -p "${RAW_PDF_DIR}"

echo "[1/4] Downloading Southampton City Council Consultation PDFs..."

# Declare dataset mapping: "filename|dataset_id|domain|url"
DATASETS=(
    "s77446_district_carparks.pdf|s77446_carparks|Transport_Parking|https://www.southampton.gov.uk/moderngov/documents/s77446/MRD%201%20-%20Consultation%20Responses.pdf"
    "s59108_portswood_comments.pdf|s59108_portswood_p1|Transport_ActiveTravel|https://www.southampton.gov.uk/moderngov/documents/s59108/Appendix%202%20Portswood%20Corridor%20Consultation%20Comments%20Report.pdf"
    "psg29_portswood_annex_b.pdf|psg29_portswood_log|Transport_YouSaidWeDid|https://transport.southampton.gov.uk/media/3302/psg29_annex-b-log-of-comments-responses.pdf"
    "portswood_final_2024.pdf|media3131_portswood_p2|Transport_ActiveTravel|https://transport.southampton.gov.uk/media/3131/portswood-project-consultation-final-feedback-report-040124.pdf"
    "s50527_licensing_persian_centre.pdf|s50527_licensing|Licensing_Statutory|https://www.southampton.gov.uk/moderngov/documents/s50527/NEW%20APPLICATION%20FOR%20PREMISES%20LICENCE%20-%20PERSIAN%20CULTURAL%20CENTRE%201%20MANOR%20FARM%20ROAD%20SOUTHAMPTON%20SO18%20.pdf"
    "s69290_council_tax_feedback.pdf|s69290_budget|Fiscal_CouncilTax|https://www.southampton.gov.uk/moderngov/documents/s69290/Appendix%203%20Budget%20Consultation%20Council%20Tax%20Proposals%20Feedback.pdf"
    "s57570_pna_briefing.pdf|s57570_pna|Health_PNA|https://www.southampton.gov.uk/moderngov/documents/s57570/Appendix%201%20for%20Pharmaceutical%20Needs%20Assessment%20Briefing.pdf"
)

for entry in "${DATASETS[@]}"; do
    IFS='|' read -r filename dataset_id domain url <<< "${entry}"
    target_path="${RAW_PDF_DIR}/${filename}"
    if [[ ! -f "${target_path}" ]]; then
        echo "  -> Fetching ${dataset_id} (${filename})..."
        curl -sSL -A "Mozilla/5.0 (compatible; CivicNLPResearch/1.0)" --retry 3 "${url}" -o "${target_path}" || echo "  [!] Warning: Failed to download ${url}"
    else
        echo "  -> Skipping ${filename} (already downloaded)"
    fi
done

if [[ "${CONSULTATION_NIX_ENV:-}" == "1" ]]; then
    echo "[2/4] Using Nix-managed Python extraction environment..."
else
    echo "[2/4] Setting up isolated Python extraction environment..."
    if [[ ! -d "${VENV_DIR}" ]]; then
        python3 -m venv "${VENV_DIR}"
    fi
    source "${VENV_DIR}/bin/activate"
    pip install --quiet --upgrade pip
    pip install --quiet pandas pyarrow pymupdf pdfplumber
fi

echo "[3/4] Extracting, cleaning, and aggregating consultation records..."

python3 - "${RAW_PDF_DIR}" "${OUTPUT_CSV}" "${OUTPUT_PARQUET}" << 'EOF'
import sys
import os
import re
import fitz  # PyMuPDF
import pdfplumber
import pandas as pd

raw_dir, out_csv, out_parquet = sys.argv[1], sys.argv[2], sys.argv[3]

METADATA = {
    "s77446_district_carparks.pdf": ("s77446_carparks", "Transport_Parking", "verbatim_paragraphs"),
    "s59108_portswood_comments.pdf": ("s59108_portswood_p1", "Transport_ActiveTravel", "tables_and_text"),
    "psg29_portswood_annex_b.pdf": ("psg29_portswood_log", "Transport_YouSaidWeDid", "tables_and_text"),
    "portswood_final_2024.pdf": ("media3131_portswood_p2", "Transport_ActiveTravel", "verbatim_paragraphs"),
    "s50527_licensing_persian_centre.pdf": ("s50527_licensing", "Licensing_Statutory", "verbatim_paragraphs"),
    "s69290_council_tax_feedback.pdf": ("s69290_budget", "Fiscal_CouncilTax", "verbatim_paragraphs"),
    "s57570_pna_briefing.pdf": ("s57570_pna", "Health_PNA", "tables_and_text"),
}

BOILERPLATE_PATTERNS = [
    r"CAUTION:\s*This email originated from a non UK Government address.*?(?=\n|\.$)",
    r"Do not click links or open attachments unless you recognise the sender.*?(?=\n|\.$)",
    r"Page \d+ of \d+",
]

def clean_text(text: str) -> str:
    if not text:
        return ""
    for pat in BOILERPLATE_PATTERNS:
        text = re.sub(pat, "", text, flags=re.IGNORECASE | re.DOTALL)
    # Normalize redact tokens and whitespace
    text = re.sub(r"\[?\bREDACTED\b\]?", "[REDACTED]", text, flags=re.IGNORECASE)
    text = re.sub(r"\s+", " ", text).strip()
    return text

records = []

for fname, (dataset_id, domain, mode) in METADATA.items():
    fpath = os.path.join(raw_dir, fname)
    if not os.path.exists(fpath) or os.path.getsize(fpath) < 1000:
        print(f"  [!] Skipping {fname} (missing or empty)")
        continue

    print(f"  -> Parsing {fname} ({mode})...")

    # Pass 1: Extract structured table rows where applicable (e.g., "You Said / We Did" or comment logs)
    if mode == "tables_and_text":
        try:
            with pdfplumber.open(fpath) as pdf:
                for page_num, page in enumerate(pdf.pages, start=1):
                    tables = page.extract_tables()
                    for t_idx, table in enumerate(tables):
                        for r_idx, row in enumerate(table):
                            cleaned_cells = [clean_text(str(c)) for c in row if c and str(c).strip()]
                            if not cleaned_cells:
                                continue
                            joined_row = " | ".join(cleaned_cells)
                            # Filter out tiny header rows
                            if len(joined_row) >= 40:
                                records.append({
                                    "comment_id": f"{dataset_id}_p{page_num}_t{t_idx}_r{r_idx}",
                                    "dataset_id": dataset_id,
                                    "policy_domain": domain,
                                    "source_file": fname,
                                    "page_number": page_num,
                                    "extraction_type": "table_row",
                                    "comment_text": joined_row,
                                    "officer_response_pair": cleaned_cells[1] if len(cleaned_cells) > 1 else None,
                                    "char_length": len(joined_row),
                                    "word_count": len(joined_row.split())
                                })
        except Exception as e:
            print(f"  [!] Table extraction warning on {fname}: {e}")

    # Pass 2: Extract block-level paragraphs via PyMuPDF for all documents
    try:
        doc = fitz.open(fpath)
        for page_num, page in enumerate(doc, start=1):
            blocks = page.get_text("blocks")
            for b_idx, b in enumerate(blocks):
                # b[4] contains the text content of the block, b[6] == 0 indicates text (not image)
                if b[6] != 0:
                    continue
                cleaned = clean_text(b[4])
                # Retain blocks substantial enough to represent a comment or claim (>= 45 chars)
                if len(cleaned) >= 45:
                    records.append({
                        "comment_id": f"{dataset_id}_p{page_num}_b{b_idx}",
                        "dataset_id": dataset_id,
                        "policy_domain": domain,
                        "source_file": fname,
                        "page_number": page_num,
                        "extraction_type": "text_block",
                        "comment_text": cleaned,
                        "officer_response_pair": None,
                        "char_length": len(cleaned),
                        "word_count": len(cleaned.split())
                    })
    except Exception as e:
        print(f"  [!] Block extraction error on {fname}: {e}")

df = pd.DataFrame(records)

if not df.empty:
    # Deduplicate identical text blocks within the same dataset
    df = df.drop_duplicates(subset=["dataset_id", "comment_text"]).reset_index(drop=True)
    df.to_csv(out_csv, index=False, encoding="utf-8")
    df.to_parquet(out_parquet, index=False)
    print(f"\n[4/4] Success! Aggregated {len(df):,} records across {df['dataset_id'].nunique()} Southampton consultations.")
    print(f"  -> CSV saved to:     {out_csv}")
    print(f"  -> Parquet saved to: {out_parquet}")
else:
    print("\n[!] No records were extracted. Check network access or PDF URLs.")
    sys.exit(1)
EOF

if [[ "${CONSULTATION_NIX_ENV:-}" != "1" ]]; then
    deactivate
fi
