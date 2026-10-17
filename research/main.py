import pandas as pd

# Load the aggregated corpus
df = pd.read_parquet("./southampton_consultation_data/southampton_consultations_aggregated.parquet")

# Or load via CSV:
# df = pd.read_csv("./southampton_consultation_data/southampton_consultations_aggregated.csv")

print(df.info())
print(df.groupby(["dataset_id", "extraction_type"])["comment_id"].count())

# Example: Isolate the District Centre Car Parks verbatim objections (s77446) for Stage 1 filtering
carparks_df = df[df["dataset_id"] == "s77446_carparks"].copy()
print(carparks_df[["comment_id", "word_count", "comment_text"]].head())
