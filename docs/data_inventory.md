# Data Inventory

| File | Size | Notes |
| --- | ---: | --- |
| `All Business 2016.csv` | 106,483,295 bytes | Original CSV export. Header begins with `LegalStatusNameEng`, `BusinessName`, `Capital`, manager fields, phone fields, location fields, house number, and telephone. |
| `All Business 2016.xlsx` | 49,875,823 bytes | Excel version of the 2016 business dataset. |
| `All business 2016 cleaned.xlsx` | 53,824,730 bytes | Cleaned Excel workbook. |
| `All_business_2016_DeepTaxonomy.csv` | 94,853,963 bytes | Enriched CSV with `sector`, `Macro_Sector`, `Primary_Business_Type`, and `Business_Specialty`. Rebuilt 2026-09-01 from `All business 2016 cleaned.xlsx` after the original was truncated; 345,369 records. See `docs/taxonomy_rebuild.md`. |
| `Sample.csv` | 2,100 bytes | Small sample with normalized columns matching the taxonomy dataset. |

## Observed Columns

`Sample.csv` columns:

`legal_status_name`, `busi_name`, `capital`, `mgr_fname`, `mgr_mname`, `mgr_lname`, `mgr_phone`, `sub_group`, `house_num`, `busi_phone`, `region`, `zone`, `woreda`, `busi_desc`, `sector`

`All_business_2016_DeepTaxonomy.csv` includes the sample columns plus:

`Macro_Sector`, `Primary_Business_Type`, `Business_Specialty`
