# Data Inventory

| File | Size | Notes |
| --- | ---: | --- |
| `All Business 2016.csv` | 106,483,295 bytes | Original CSV export. Header begins with `LegalStatusNameEng`, `BusinessName`, `Capital`, manager fields, phone fields, location fields, house number, and telephone. |
| `All Business 2016.xlsx` | 49,875,823 bytes | Excel version of the 2016 business dataset. |
| `All business 2016 cleaned.xlsx` | 53,824,730 bytes | Cleaned Excel workbook. |
| `All_business_2016_DeepTaxonomy.csv` | 78,382,440 bytes | Enriched CSV with `sector`, `Macro_Sector`, `Primary_Business_Type`, and `Business_Specialty`. Rebuilt 2026-09-01 from `All business 2016 cleaned.xlsx` after the original was truncated; 345,369 records. Reduced to 12 columns on 2026-10-03 when the direct identifiers were removed — see below. See `docs/taxonomy_rebuild.md`. |
| `Sample.csv` | 2,100 bytes | Small sample with normalized columns matching the taxonomy dataset. |

## Observed Columns

`Sample.csv` columns:

`legal_status_name`, `busi_name`, `capital`, `mgr_fname`, `mgr_mname`, `mgr_lname`, `mgr_phone`, `sub_group`, `house_num`, `busi_phone`, `region`, `zone`, `woreda`, `busi_desc`, `sector`

`All_business_2016_DeepTaxonomy.csv`, as of 2026-10-03, has 12 columns:

`legal_status_name`, `busi_name`, `capital`, `sub_group`, `region`, `zone`, `woreda`,
`busi_desc`, `sector`, `Macro_Sector`, `Primary_Business_Type`, `Business_Specialty`

## Direct identifiers removed from the enriched file

On 2026-10-03 the three manager name fields, both telephone numbers and the house number
were deleted from `All_business_2016_DeepTaxonomy.csv`, taking it from 18 columns to 12.

The aggregation reads nine columns — `sector`, `Macro_Sector`, `Primary_Business_Type`,
`region`, `legal_status_name`, `capital`, `zone`, `woreda`, `Business_Specialty` — and none
of the removed six. Re-running `scripts/prepare_profile_viz_data.py` against the reduced file
produced a `business_landscape.json` **byte-identical** to the published one
(SHA-256 `754490068242a099f1889b87c2911c309644c2194bcdc6127ca3291d7bbfe8d4`, verified by a
recursive comparison of every value: zero differences across 25 top-level keys). Every figure
on the site and in this documentation is therefore unaffected.

`busi_name` was deliberately kept. It is worth being explicit about what that means: for
295,661 of the 345,369 rows (85.6%) the business name parses as a personal name, and 291,763
of those are sole proprietorships where the business name simply *is* the owner. The file
remains PII-bearing and stays excluded from Git by `.gitignore`. No script in `scripts/`
reads `busi_name` for aggregation, and `scripts/test_privacy.py` fails the build if that
column name appears anywhere in the published output.
