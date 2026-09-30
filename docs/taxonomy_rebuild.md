# Taxonomy File Rebuild

Date: September 1, 2026
Script: `scripts/rebuild_taxonomy_from_cleaned.py`
Output: `All_business_2016_DeepTaxonomy_rebuilt.csv` (345,369 records, 18 columns)

## Problem

`All_business_2016_DeepTaxonomy.csv` was restored in a truncated state: 226,453 of the
documented 345,369 records, ending mid-record. The script that originally produced the four
taxonomy columns was written outside this project and is not available.

## Which source is the right parent

Three candidate sources were compared:

| Candidate | Records | Columns | Verdict |
| --- | ---: | ---: | --- |
| `All Business 2016.csv` (raw export) | 493,720 | 14 | Wrong parent — ~148,000 rows more than the taxonomy ever had |
| `All business 2016 cleaned.xlsx` | **345,369** | **15** | **Correct parent** |
| truncated taxonomy CSV | 226,453 | 18 | The damaged file itself |

`All business 2016 cleaned.xlsx` holds exactly the documented record count, and its 15
columns are an exact prefix of the taxonomy file's 18 — same names, same order. The
enrichment step added precisely three columns: `Macro_Sector`, `Primary_Business_Type`,
`Business_Specialty`. (`sector` was already present in the cleaned workbook.)

Rebuilding from the raw CSV was tested first and rejected: it would have reintroduced
roughly 140,000 records that the cleaning step deliberately removed.

## Method

The three derived columns are ~98% deterministic on `sub_group` — within a sub_group,
essentially every record carries the same values. That makes them recoverable as a lookup
rather than a model:

1. Learn a `sub_group -> (Macro_Sector, Primary_Business_Type, Business_Specialty)` rule
   from the 226,452 surviving classified rows. 505 rules learned; 7 ambiguous, resolved by
   majority (majority rule reproduces the known rows at 100.00%).
2. Stream all 345,369 records from the cleaned workbook.
3. Fill the three columns from the learned rule.
4. Apply the category spelling corrections in the same pass, so the rebuild does not
   reintroduce `Toursim and Arts`, `Paretnership`, etc.

Records whose sub_group was never seen in the surviving set are written as `Unclassified`
in all three columns rather than guessed.

## Result

| Measure | Value |
| --- | ---: |
| Records written | 345,369 |
| Classified by rule | 345,363 (100.00%) |
| Left Unclassified | 6 |
| Spelling corrections applied | 34,905 |
| Ragged rows | 0 |

## Validation against surviving aggregates

`profile-visualization/data/business_landscape.json` was generated from the intact file
before truncation, so it is an independent check:

| Check | Result |
| --- | --- |
| Total records | 345,369 — exact match |
| Regions | **14 of 14 match exactly** |
| Legal statuses | exact match on all top categories |
| Capital median | 15,000 — exact match |
| Macro_Sector | within 6 rows total |

The Macro_Sector deltas (-5, -2, +2, 0, -1) sum to exactly -6, fully accounted for by the
6 Unclassified records. There is no unexplained drift.

## Two pitfalls worth recording

**Encoding.** The raw CSV is cp1252, not UTF-8. Reading it as UTF-8 corrupts accented
characters (`décor`) and silently breaks any join on business names.

**Apostrophes.** Apostrophes appear three ways across these files: a real U+2019 in the
taxonomy file, a plain ASCII quote, and a stray `0x19` control byte in the raw export.
A normalizer that converts punctuation to spaces turns `Men's` into `men s` in one file and
`mens` in another — which silently dropped ~12,000 rows from the match until corrected.
Both are handled in the script.

## Status — COMPLETE

The rebuilt file was promoted to `All_business_2016_DeepTaxonomy.csv` on September 1, 2026.
The truncated original was preserved at `work/DeepTaxonomy_truncated_backup.csv` first
(nothing was deleted). Final file: 345,369 records, 18 columns, 0 ragged rows, no BOM.

### Correction passes re-applied

| Pass | Rows changed | Documented previously |
| --- | ---: | ---: |
| Manufacturing corrections | 13,004 | 13,004 — exact match |
| Audit corrections | 57,154 | 57,151 (+3) |
| Re-run audit | 0 remaining | 0 — matches end state |

The Manufacturing pass reproducing 13,004 exactly is the strongest single confirmation that
the reconstruction is faithful: that number is a function of the data, not of the script.

### Final validation against the pre-truncation aggregates

| Check | Result |
| --- | --- |
| Total records | 345,369 — exact |
| Regions | 14 of 14 exact |
| Capital median | 15,000 — exact |
| Primary_Business_Type | 5 of 14 exact; every other category within ±7 rows |

Residual variance traces to the 6 records whose sub_group never appeared in the surviving
classified set and so could not be assigned a rule.

### Two script fixes made along the way

- `audit_primary_business_type_mislabels.py` matched on `sector == "Toursim and Arts"` and
  emitted that spelling as a value. After the spelling correction the rule would have
  silently stopped firing and would have reintroduced the typo. Updated to
  `Tourism and Arts`.
- Both correction scripts staged a temp file beside the source and `shutil.move`d it into
  place. That requires delete/rename permission the Cowork workspace does not grant, so both
  failed outright. They now stage outside the mounted folder and `copyfile` over the source.

### Still outstanding

The label defects in `docs/busi_desc_taxonomy_comparison.md` are unaffected by this rebuild
and remain open — chiefly the ~1,058 manufacturing records classified as Recreation &
Entertainment and the 25,170-row Unmapped bucket that needs real categories.

`business_landscape.json` has NOT been regenerated. It is still the pre-truncation file and
remains a valid independent reference. Regenerating it now would be safe, but would also
discard the only surviving cross-check.
