# Taxonomy Label Audit — restored `All_business_2016_DeepTaxonomy.csv`

Audit date: September 1, 2026
File audited: `All_business_2016_DeepTaxonomy.csv` (61,517,092 bytes, mtime 2026-09-01 07:21)

Read-only audit. No changes were made to the CSV.

---

## 1. Blocking issues — resolve before any data preparation run

### 1.1 The file is incomplete

| Measure | Documented | Restored file |
| --- | ---: | ---: |
| Size (bytes) | 94,006,892 | 61,517,092 |
| Records | 345,369 | 226,453 |

The restored file holds **65.6% of the expected records**; roughly 118,916 are absent.
The final line ends mid-record (2 fields instead of 18), which is the signature of an
interrupted write rather than a deliberate subset. File size was stable across repeated
checks, so the copy is finished, not still running.

Regional proportions track the full dataset closely (Oromia 104,334 vs 163,476 documented;
Addis Ababa 50,750 vs 75,794), so this reads as a truncated prefix of the same export,
not a different sample.

### 1.2 The file predates the applied corrections

None of the previously applied corrections are present. Verified directly:

- `sector = Manufacturing` still contains `Recreation & Entertainment` (1,065 records) —
  the exact defect the Manufacturing correction pass removed.
- None of the corrected Manufacturing labels exist (`Industrial & Materials Manufacturing`,
  `Food & Beverage Manufacturing`, `Textile & Leather Manufacturing`, etc.).
- All five audit rules in `docs/primary_business_type_applied_corrections.csv` are unapplied:

| busi_desc / sub_group | Current label | Expected after correction | Rows |
| --- | --- | --- | ---: |
| Special houses retail trade | Agriculture Retail | General Consumer Goods | 550 |
| growing of Crop and holticulture development | Industrial & Materials | Agriculture | 365 |
| Tour operation services | Professional & General Services | Toursim and Arts | 189 |
| Telecommunication value added service | Professional & General Services | Logistics & Transportation | 74 |
| Postal and fast carrier service activities | Professional & General Services | Logistics & Transportation | 73 |

The largest correction — 55,236 `(6215)Department stores retail trade` records moving from
`Food & Grocery` to `General Consumer Goods` — cannot be evaluated because those records
fall in the truncated tail.

**Consequence:** running `scripts/prepare_profile_viz_data.py` against this file would
overwrite `profile-visualization/data/business_landscape.json` with aggregates that are both
incomplete and pre-correction. The current JSON is the only surviving correct derivative.
Do not regenerate until the source is restored in full and corrections are re-applied.

---

## 2. Header — correct

18 columns, matching the documented schema exactly:

`legal_status_name, busi_name, capital, mgr_fname, mgr_mname, mgr_lname, mgr_phone,
sub_group, house_num, busi_phone, region, zone, woreda, busi_desc, sector, Macro_Sector,
Primary_Business_Type, Business_Specialty`

Column order and spelling are unchanged. Only one row is ragged (the truncated final line).

---

## 3. Category labels — issues found

### 3.1 Misspellings in category values

| Column | Value as stored | Records | Should be |
| --- | --- | ---: | --- |
| `sector` | `Toursim and Arts` | 1,023 | `Tourism and Arts` |
| `Primary_Business_Type` | `Toursim and Arts` | 259 | `Tourism and Arts` |
| `legal_status_name` | `Paretnership` | 16,852 | `Partnership` |
| `legal_status_name` | `Ordinary Paretnership` | 3 | `Ordinary Partnership` |
| `legal_status_name` | `Limited Liabilty Paretnership` | 1 | `Limited Liability Partnership` |
| `legal_status_name` | `Public EnterPrise` | 46 | `Public Enterprise` |
| `legal_status_name` | `Non Public EnterPrise` | 19 | `Non Public Enterprise` |
| `legal_status_name` | `share Company` | 362 | `Share Company` |

`Paretnership` affects 7.4% of all records and is the second most common legal status, so it
is highly visible in any legal-structure chart.

### 3.2 Untranslated values in `legal_status_name`

Two categories are stored in Amharic only:

- `መንግስታዊ ያልሆነ የበጎ አድራጎት ድርጅት` — 16 records (non-governmental charitable organization)
- `ኢንተርናሽናል ጨረታ ያሸነፉ የውጪ ሃገር ድርጅቶች` — 3 records (foreign firms awarded international tenders)

These need English labels for a public-facing chart, or should be folded into an "Other" bucket.

### 3.3 Sector names leaking into `Primary_Business_Type`

25,170 records (11.1%) carry a **sector** name in the `Primary_Business_Type` column instead
of an actual business type:

| Leaked value | Records |
| --- | ---: |
| Construction | 6,803 |
| Agriculture | 5,568 |
| Service | 5,449 |
| Trade | 5,392 |
| Manufacturing | 1,313 |
| Mining and quarrying | 329 |
| Toursim and Arts | 259 |
| Logistics, transport and communication | 57 |

Every one of these rows also has `Macro_Sector = Other` and `Business_Specialty = Unmapped`.
The three counts agree exactly at 25,170, so this is a single coherent catch-all bucket: the
records the taxonomy could not classify were backfilled with their sector name rather than
left blank.

This is the most consequential labelling problem for the visualization. It means the
`Other` / `Unmapped` slice is not a real category — it is 11.1% of the registry that was
never classified, currently presented as though it were a business type.

### 3.4 Hierarchy consistency

`Primary_Business_Type → Macro_Sector` is **clean** — every business type maps to exactly
one macro sector.

`Business_Specialty → Primary_Business_Type` is clean except for `Unmapped`, which attaches
to all eight leaked sector values above (the same 25,170 records).

`Macro_Sector → sector` is **many-to-many**, which is expected if Macro_Sector is a
re-mapping rather than a rollup. Most of it is legitimate, but three mappings look like errors:

| Macro_Sector | Parent sectors | Note |
| --- | --- | --- |
| Retail | Trade 113,791; **Service 119** | 119 Service records classed as Retail |
| Services | Logistics 34,213; Service 29,273; Manufacturing 1,077; Toursim 764; **Agriculture 1** | single stray Agriculture record |
| Manufacturing | Manufacturing 6,084; **Agriculture 365** | matches the 365 crop-growing rows in §1.2 |

The 365 Agriculture-to-Manufacturing rows are the same records the audit flagged for
correction to `Agriculture`, confirming that pass never ran on this file.

### 3.5 Minor

- `busi_desc` values carry embedded classification codes and inconsistent trailing spaces
  (e.g. `(6215)Department stores retail trade ` with a trailing space). `sub_group` mixes
  code-prefixed values such as `(62115)Small shop (Kiosk)` with bare text like
  `Cafe and breakfast service`. 506 distinct `sub_group` values, 189 distinct `busi_desc`.
- One record (the truncated final line) has empty values across every taxonomy column.

---

## 4. Recommended sequence

1. Re-copy the source file in full and confirm 345,369 records before anything else.
2. Re-apply the Manufacturing and audit correction passes; verify against the row counts
   recorded in `docs/manufacturing_primary_type_corrections.csv` and
   `docs/primary_business_type_applied_corrections.csv`.
3. Fix the misspellings in §3.1 at the presentation layer, not in the source data, so the
   raw registry stays faithful to what was filed. Keep a documented display-label mapping.
4. Decide how to present the 25,170 unclassified records. Relabelling them honestly
   (for example "Unclassified") is more defensible than leaving sector names standing in a
   business-type field.
5. Only then regenerate `business_landscape.json`.
