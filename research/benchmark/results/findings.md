**Expanded benchmark: no clear all-round winner.**

All five models and two baselines completed 40 fresh test comments each, with no failed predictions. Zero-shot Qwen still has the highest accuracy (62.5%), but loses 11 of the 20 useful comments. DSPy has the highest F1 score (67.8%) and keeps every useful comment, but filters only one unhelpful comment. The keyword rule has the highest precision (80%) while losing 16 useful comments. These are different trade-offs, not evidence of one model winning everything.

| Model | Useful kept / 20 | Unhelpful filtered / 20 | Precision | Recall | Accuracy | F1 | Median prediction |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Keep everything | 20 | 0 | 50.0% | 100.0% | 50.0% | 66.7% | 0.000631 ms |
| Keyword rule | 4 | 19 | 80.0% | 20.0% | 57.5% | 32.0% | 0.00615 ms |
| LightGBM | 15 | 4 | 48.4% | 75.0% | 47.5% | 58.8% | 0.501 ms |
| DeBERTa-v3-small | 20 | 0 | 50.0% | 100.0% | 50.0% | 66.7% | 85.7 ms |
| Qwen3 1.7B zero-shot | 9 | 16 | 69.2% | 45.0% | 62.5% | 54.5% | 2.29 s |
| Qwen3 1.7B DSPy | 20 | 1 | 51.3% | 100.0% | 52.5% | 67.8% | 3.59 s |
| Laya | 12 | 7 | 48.0% | 60.0% | 47.5% | 53.3% | 1.58 s |

The dataset grew from 120 to 310 real extracted comments. Unhelpful reference labels increased from 11 to 73. There are 190 newly AI-labelled parking responses: 128 useful and 62 unhelpful. Every new label has a reason, source PDF hash and evidence in labels.csv. The rubric stayed at productivity-v1.0. No expanded model predictions were used to choose comments, assign labels or choose the split.

The frozen split uses 246 training comments (205 useful, 41 unhelpful), 24 validation comments (12 of each), and 40 test comments (20 of each). All 120 original comments are training-only. Fresh validation and test examples come from the parking consultation. Test comments are matched by rough word-count band: each class has six examples of 1–5 words, seven of 6–12, six of 13–20, and one longer than 20. IDs and the dataset fingerprint are saved in ../splits.json. Exact normalized text is unique.

This is a targeted challenge sample: clear bare stances, insults, restatements and vague complaints were added alongside short useful comments and angry comments with usable points. It does not estimate how common unhelpful comments are in normal consultations. Precision is not directly comparable with the first experiment because the class mix changed, and the new test deliberately includes short useful comments. The previous experiment remains in ../previous, including its data, labels, runs and figures.

On these fixed settings, DeBERTa again keeps everything. LightGBM loses five useful comments and filters four unhelpful ones. Laya loses eight useful comments and filters seven unhelpful ones. DSPy found no validation improvement over its initial prompt (50%); its saved test predictions retain all useful comments. Neither the architecture nor the framework was exhaustively tuned. The training set is still weighted toward useful comments.

The existing scenario in which missing useful feedback costs five times as much as reading an unhelpful comment gives DSPy 19 cost units, keeping everything 20, LightGBM 41, Laya 53, zero-shot Qwen 59 and the keyword rule 81. These are illustrative decision costs, not measured money or deployment costs; they do not include model compute.

All labels are AI references and can be wrong. This single, selected 40-comment test cannot establish a general model ranking or prove that zero-shot models are inferior. It does show that the original strong zero-shot recall did not carry over to this fresh challenge set. Error cases and all decisions are in case_predictions.csv.

Timing note: the session was interrupted during DSPy optimization, so wall-clock log timestamps are not a clean compute benchmark. Reported adapter prediction latencies exclude dataset validation, loading, training and prompt optimization. Model settings and threshold stayed unchanged for the rerun.

![Precision and recall](../../figures/precision_recall.png)

Artifacts: [results](results.csv), [per-comment predictions](case_predictions.csv), [comparison report](report.html), [retention and filtering graphic](story.png). Rebuild the dataset and split with `make prepare`, run models with `make benchmark`, and regenerate figures with `make analysis`.
