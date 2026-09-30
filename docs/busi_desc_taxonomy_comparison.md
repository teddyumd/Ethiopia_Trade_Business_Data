# `busi_desc` vs. Taxonomy Columns — Comparison

Audit date: September 1, 2026
File: `All_business_2016_DeepTaxonomy.csv` (226,453 records — see §0)
Columns compared: `busi_desc` against `sector`, `Macro_Sector`, `Primary_Business_Type`, `Business_Specialty`

---

## 0. Scope caveat

This audit ran against the currently restored file, which holds 226,453 of the documented
345,369 records. Percentages below are of what is present. The patterns are structural and
should hold on the full file, but absolute counts will grow once it is restored.

---

## 1. Headline: `sub_group`, not `busi_desc`, is the classification key

`busi_desc` is the coarse field (189 distinct values); `sub_group` is the fine one
(506 distinct values). Testing consistency at each grain settles which one the taxonomy
was actually derived from:

| Grain | Distinct values | Values with inconsistent taxonomy |
| --- | ---: | ---: |
| `busi_desc` | 189 | 27 (14.3%) |
| `sub_group` | 506 | 9 (1.8%) |

At `sub_group` grain the taxonomy is **98.2% deterministic**, and all nine exceptions are
single stray rows (one row out of 5,142, one out of 3,806, and so on) — contamination, not
rule conflict.

This means most `busi_desc`-level "inconsistency" is **correct behaviour**, not error. Two
of the largest examples are the taxonomy working exactly as intended:

`(6215)Department stores retail trade` (34,198 rows) splits three ways — and the split is clean:

| Business_Specialty | sub_group | Rows |
| --- | --- | ---: |
| Tier 1: Kiosk / Micro-Retail | (62115)Small shop (Kiosk) | 31,935 |
| Tier 2/3: Grocery & Supermarket | Mini market/ , Supermarket | 2,114 |
| Standard Retail | Department Store (Mall), Hypermarket | 149 |

`(7111)Transport services` (31,889 rows) likewise splits by sub_group into Passenger &
General Transport (26,998: land, cross-country, rail, air) and Freight & Warehousing
(4,891: road/dry freight, liquid freight).

**Implication:** do not "fix" busi_desc-level inconsistency as though it were error. Judge
correctness at `sub_group` grain.

---

## 2. Real defect: manufacturing classified as Recreation & Entertainment

`Primary_Business_Type = Recreation & Entertainment` holds 6,345 rows across 25 sub_groups.
At least **1,058 of them (16.7%) are manufacturing**, matched by the literal
`Manufacture of...` prefix in sub_group:

| sub_group | Rows | Should be |
| --- | ---: | --- |
| Manufacture of articles of concrete, cement and plaster | 691 | Industrial & Materials / Heavy Manufacturing |
| Manufacture of textile articles, textile ascceris | 173 | Textile manufacturing |
| Manufacture of made-up textile articles, spinning and weaving (except apparel) | 128 | Textile manufacturing |
| Manufacture of handicrafts, souvenirs, artifacts and artificial jewelries | 33 | Consumer goods manufacturing |
| Manufacture of artificial leather Substitutes | 17 | Textile & leather manufacturing |
| Manufacture of communication machineries, spare parts and apparatus | 16 | Electronics & equipment manufacturing |

These rows also carry `Macro_Sector = Services` and `Business_Specialty = Venue / Activities`,
so a cement plant currently reads as a Services-sector entertainment venue in every chart.

One further stray in the same bucket: `Geospatial (earth information) service` (41 rows) is a
professional service, not recreation.

This is the same defect class the earlier Manufacturing correction pass addressed. That pass
is not present in this file (see `docs/taxonomy_label_audit.md` §1.2).

---

## 3. Real defect: crop production classified as Industrial & Materials

`busi_desc = 'growing of Crop and holticulture development'` (814 rows) splits by sub_group:

- 449 rows → `Agriculture` / Unmapped — correct sector, no specialty
- **365 rows → `Industrial & Materials` / `Heavy Manufacturing`**, all from sub_group
  `Vegetable, fruit, plant and plant seed production`

Vegetable and seed production is agriculture. These 365 rows also push `Macro_Sector` to
`Manufacturing`, and they are the sole reason `Manufacturing` appears to have `Agriculture`
as a parent sector in the hierarchy check.

Additional sector-level misfile: `Software development` (127 rows) sits under
`sector = Manufacturing`.

---

## 4. The `Unmapped` bucket is eight coherent industries, not noise

25,170 rows (11.1%) carry `Macro_Sector = Other`, `Business_Specialty = Unmapped`, and a
*sector name* in `Primary_Business_Type`. Broken out, this is not residual noise — it is
eight nameable industries the taxonomy simply has no category for:

| Sector | Rows | What is actually in it |
| --- | ---: | --- |
| Construction | 6,803 | Building, road, water, electrical contractors |
| Agriculture | 5,568 | Cattle & pack animals, poultry, cereals, coffee/tea supply, floriculture |
| Service | 5,449 | Property brokerage (2,016), property subletting (913), printing (706), real estate development |
| Trade | 5,392 | Agricultural wholesale — cereals, coffee/tea, fruit & veg, pulses, spices, oilseeds |
| Manufacturing | 1,313 | Wood products (849), recycling (319), software (127) |
| Mining and quarrying | 329 | Stone/clay/sand quarrying, mineral excavation |
| Tourism and Arts | 259 | Travel agency representation |
| Logistics | 57 | Electric line extension, electricity generation |

Every one of these is a legitimate category that could be named. Construction contracting and
agricultural wholesale in particular are substantial industries being rendered as "Other".

**Recommendation:** extend the taxonomy with categories for Construction Contracting,
Agricultural Production, Agricultural Wholesale, Real Estate & Property Services, and Mining
& Quarrying. That alone would reclassify roughly 23,500 of the 25,170 unmapped rows and
remove the misleading "Other" slice from the visualization.

---

## 5. Single-row contamination

Nine sub_groups each contain exactly one row whose taxonomy disagrees with the other
thousands sharing that sub_group — e.g. one row of `Retail trade in food products` (5,142
rows) labelled `Agriculture Retail`; one row of `Growing of cereals` (176) labelled
`Professional & General Services`. Roughly ten rows in total. Low impact, trivially fixable
by majority-vote within sub_group.

---

## 6. Genuine ambiguity worth a deliberate rule

These splits are not obviously wrong, but they are not obviously right either, and they
should be decided rather than left to chance:

- `Chemicals wholesale trade` (867) → General Consumer Goods 779 / Agriculture Retail 71 /
  Food & Grocery 17
- `Sporting goods and appliances retail trade` (194) → Tech & Electronics 120 /
  Apparel & Textiles 74. Sporting goods is arguably neither.
- `Bookstore, library, museum works...` (102) → Recreation & Entertainment 84 /
  Professional & General Services 18

---

## 7. Summary

| Finding | Rows | Severity |
| --- | ---: | --- |
| Manufacturing labelled Recreation & Entertainment | ~1,058 | High — visibly wrong in charts |
| Crop production labelled Industrial & Materials | 365 | High — corrupts sector hierarchy |
| Unmapped bucket lacking real categories | 25,170 | High — 11.1% shown as "Other" |
| Software development under Manufacturing sector | 127 | Medium |
| Single-row contamination | ~10 | Low |
| Ambiguous rules needing a decision | ~1,160 | Low, but worth settling |

Taxonomy structure itself is sound: `Primary_Business_Type -> Macro_Sector` has zero
violations, and classification is 98.2% deterministic on `sub_group`. The defects are
concentrated in specific rules, not spread through the system.
