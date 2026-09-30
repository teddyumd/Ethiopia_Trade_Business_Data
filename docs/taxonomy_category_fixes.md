# Taxonomy Category Fixes

Date: September 1, 2026
Scripts: `scripts/taxonomy_category_map.py`, `scripts/apply_taxonomy_category_fixes.py`
Audit: `docs/taxonomy_category_fixes.csv`
Rows changed: **43,583** across three runs (41,589 + 630 + 1,364)

Applied to the source CSV, per the project convention of fixing data at the source rather
than at the presentation layer. The script is idempotent — a re-run reports zero changes.

## What was wrong

**A. An 11.5% catch-all that was not a category.** 39,858 records carried
`Macro_Sector = Other`, `Business_Specialty = Unmapped`, and a *sector name* standing in for
`Primary_Business_Type`. These were not residual noise: broken out by sub_group they were
eight coherent industries — construction contracting, agricultural production, agricultural
wholesale, real estate, mining, printing, utilities, IT services — that the taxonomy had no
slot for. 78 sub_groups were mapped by hand.

**B. Macro_Sector left stale by the correction passes.** The Primary_Business_Type correction
passes rewrote the type but not the two columns around it, so 3,818 manufacturing records
still read as `Services`/`Other` with specialty `Venue / Activities`. A cement plant
presented as an entertainment venue.

**C. Manufacturing hidden under Recreation & Entertainment.** Vehicle, motorcycle and bicycle
manufacture sat in Recreation & Entertainment because their `sector` is Logistics, so the
Manufacturing pass never examined them.

**D. Crop production classified as heavy industry.** 630 records of
`Vegetable, fruit, plant and plant seed production` had been corrected to
`Primary_Business_Type = Agriculture` but kept `Macro_Sector = Manufacturing` and
`Business_Specialty = Heavy Manufacturing`.

**E. Self-contradicting specialties.** 1,364 records where the specialty contradicted its own
type — General Consumer Goods records whose specialty still said `Farming Supplies /
Livestock`, tour operators labelled `Consulting / Support`.

## Taxonomy changes

Three macro sectors added to the original five, naming industries previously buried in "Other":

| Macro_Sector | Records | Share |
| --- | ---: | ---: |
| Retail | 180,426 | 52.2% |
| Services | 105,144 | 30.4% |
| Hospitality | 24,731 | 7.2% |
| Manufacturing | 12,824 | 3.7% |
| **Agriculture** (new) | 10,820 | 3.1% |
| **Construction** (new) | 10,755 | 3.1% |
| **Extractive** (new) | 669 | 0.2% |
| ~~Other~~ | **0** | **0%** |

New `Primary_Business_Type` values: Construction Contracting, Agricultural Production,
Agricultural Wholesale, Real Estate & Property, Printing & Media, Employment Services,
Marketing & Events, Waste & Sanitation, Accounting & Audit, IT & Software Services,
Mining & Quarrying, Utilities.

The specialty tier is now populated for every record — for example Construction Contracting
resolves into Building Contractor (3,691), General Contractor (2,789), Road Works (1,875),
Finishing & Fit-Out (947), Water Works (946), Electrical & Electromechanical (280) and Site
Preparation (227).

## Verification

| Check | Result |
| --- | --- |
| Records | 345,369 — unchanged |
| Columns / ragged rows | 18 / 0 |
| Regions vs pre-truncation reference | 14 of 14 exact |
| Capital median | 15,000 — unchanged |
| Legal status counts | unchanged |
| Sector names leaking into Primary_Business_Type | **0** (was 27,000+) |
| `Unmapped` / `Unclassified` specialties | **0** (was 39,858) |
| Primary_Business_Type → Macro_Sector violations | **0** |
| Contradictory specialty assignments | **0** |
| Re-run idempotency | 0 changes |

`Heavy Manufacturing` and `Consulting / Support` remain shared across several types by design;
the specialty tier is descriptive, not a strict single-parent child.

## Consequence for the report

The "Other" slice is gone, and three real industries emerged from it. Agricultural production
(10,820) and construction contracting (10,755) each turn out to be nearly as large as all of
Manufacturing (12,824) — three production sectors of comparable size that the old taxonomy
either buried in "Other" or scattered across Services. All three together still account for
under 10% of the registry against retail's 52.2% and services' 30.4%, which sharpens rather
than softens the report's core point about an economy of small traders.

## Still outstanding

`business_landscape.json` has not been regenerated and no longer reflects the source. It was
retained through the rebuild as an independent cross-check; that role is now complete, so it
is safe to regenerate whenever the visualization work resumes.
