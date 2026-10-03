# Work Completed So Far

Last updated: September 1, 2026

## Project Purpose

This project is a portfolio-ready data visualization website based on Ethiopia business registration data. The goal is to show practical data visualization, data cleaning, data storytelling, and front-end implementation skills without using an unnecessarily complex technology stack.

The core question guiding the work is:

> What does Ethiopia's formal business landscape look like, where is it concentrated, and which business categories account for the largest reported capital?

## Intended Audience

The visualization was framed for several possible users:

- Policy makers who need to understand where formal business activity is concentrated.
- Investors, banks, and business-service providers who want to identify sector and capital concentrations.
- Entrepreneurs who want to compare activity and competition by region or business type.
- Researchers, journalists, and the public who need a readable summary of a large registry dataset.
- Portfolio reviewers who need to see evidence of data preparation, analysis, visual design, and interactive chart-building skill.

## Technology Stack

The selected stack is intentionally modest and appropriate for someone demonstrating roughly 2-5 years of applied data and web visualization experience:

- Python for data preparation and CSV aggregation.
- Python standard library CSV processing instead of a heavier dependency stack.
- Static HTML, CSS, and JavaScript for the website.
- D3.js for interactive charts.
- A local static server for previewing at `http://localhost:8008/`.

This avoids a backend, database, React framework, cloud warehouse, or dashboard platform. The point is to make the work easy to explain while still showing strong data reasoning and implementation skill.

## Current Project Structure

Current root folder:

`<project-root>`

Important folders and files:

- `.gitignore` - excludes raw data, work files, outputs, and Python/editor caches.
- `README.md` - describes the workspace and existing data files.
- `docs/` - project notes, data inventory, audits, correction logs, and methodology.
- `scripts/` - reusable Python scripts for data preparation and classification audits.
- `profile-visualization/` - the static website.
- `profile-visualization/index.html` - website structure.
- `profile-visualization/styles.css` - visual design and responsive layout.
- `profile-visualization/app.js` - D3 charting, filtering, tooltip, and interaction logic.
- `profile-visualization/data/business_landscape.json` - aggregated public-facing data used by the website.
- `notebooks/`, `outputs/`, and `work/` - reserved for exploration, generated outputs, and temporary files.

## Source Data Files Observed

The project root includes these data files:

- `All Business 2016.csv`
- `All Business 2016.xlsx`
- `All business 2016 cleaned.xlsx`
- `All_business_2016_DeepTaxonomy.csv`
- `Sample.csv`

Important current-state note: the existing `docs/data_inventory.md` records `All_business_2016_DeepTaxonomy.csv` as a 94,006,892-byte enriched CSV. The current filesystem listing now shows `All_business_2016_DeepTaxonomy.csv` as `0` bytes. The generated website data file still contains aggregated results for 345,369 records, so it appears the visualization JSON was produced earlier from the populated source file. Do not rerun the data-preparation script until the enriched CSV source file is restored or verified.

## Data Fields Used

The public visualization was built around aggregated versions of these fields:

- `region`
- `sector`
- `Macro_Sector`
- `Primary_Business_Type`
- `Business_Specialty`
- `legal_status_name`
- `capital`
- `busi_desc`
- `sub_group`

Personal or sensitive fields such as business names, manager names, phone numbers, and address-level contact details are not exported to the website JSON.

## Generated Public Dataset

The website reads from:

`profile-visualization/data/business_landscape.json`

Current generated summary:

- Total records: 345,369
- Regions: 14
- Sectors: 8
- Primary business types: 30
- Records with capital values: 345,369
- Capital minimum: 0 ETB
- Capital p25: 5,000 ETB
- Median capital: 15,000 ETB
- Capital p75: 100,000 ETB
- Capital p90: 500,000 ETB
- Capital p99: 10,000,000 ETB
- Sector/business-type capital tiles currently available for the treemap: 32
- Region-level capital composition groups: 14

The JSON includes aggregated counts, capital summaries, region profiles, sector profiles, business-type capital totals, sector capital composition, and region capital composition.

## Data Preparation Script

Created:

`scripts/prepare_profile_viz_data.py`

What it does:

- Reads `All_business_2016_DeepTaxonomy.csv`.
- Cleans blank values into `Unknown`.
- Parses `capital` values as numeric values.
- Rejects invalid, non-finite, and negative capital values.
- Counts records by region, sector, macro sector, legal status, and primary business type.
- Creates region profiles with sector mix and top business types.
- Creates sector profiles with top regions and top business types.
- Calculates capital percentiles by sector, region, and region-sector.
- Calculates total capital by business type and by sector/business-type.
- Creates capital composition data for the treemap.
- Creates region-specific capital composition data so the Capital Concentration chart can update by region.
- Writes the public aggregate file to `profile-visualization/data/business_landscape.json`.

## Privacy Work

The website data export intentionally excludes record-level names and phone fields. The public JSON is aggregated so the profile project demonstrates analysis without exposing business owner or contact details.

Privacy note in the generated JSON:

`The visualization exports aggregated counts only; names and phone numbers are not included.`

## Website Created

Created a static website in:

`profile-visualization/`

The page includes:

- A portfolio-style title and project framing.
- High-level summary cards.
- Region and sector filters.
- A filter context sentence explaining which charts are affected.
- A regional registration ranking chart.
- A sector mix donut chart.
- A top business type chart.
- A Capital Concentration treemap.
- A two-region comparison section.
- A sector share comparison chart.
- A business type comparison chart.
- A short comparison takeaway.

## Filter Behavior

The overview filters were revised so they are functional and clear:

- Selecting a region updates the summary, sector mix, and business-type chart.
- Selecting a sector updates the summary, regional ranking, and business-type chart.
- Selecting both a region and sector updates the summary and top business types for that combination.
- The regional ranking continues to show where the selected sector appears nationally.
- The Capital Concentration chart has its own region selector because it answers a separate capital-composition question.

The filter context text now tells the reader which charts are affected by the active filter.

## Sector Mix Chart Work

The sector mix chart began as a donut chart with labels inside or too close to the chart, which made longer labels hard to read.

Improvements made:

- Moved labels outside the donut.
- Added leader lines connecting labels to slices.
- Added white label boxes for readability.
- Added responsive label placement so labels stay inside the chart bounds.
- Added shortening of long labels when the available space is too narrow.
- Preserved hover tooltips for exact sector counts.

## Region Comparison Work

Added a comparison section so users can compare two regions fairly.

The section includes:

- First region selector.
- Second region selector.
- Summary cards comparing the selected regions.
- A written takeaway describing the comparison.
- Sector share stacked bars.
- Business type comparison bars.

Reason for using shares:

Regions have very different total registration counts. Percent shares make structure comparable, while raw counts still appear in tooltips for context.

## Sector Share Chart Work

The sector share stacked bar chart had label and legend overlap with the x-axis.

Improvements made:

- Kept the x-axis separate from the legend.
- Rendered the legend as a wrapping row below the chart.
- Reduced clutter in the chart body.
- Preserved hover details for exact values.

## Business Type Difference Chart Work

An earlier diverging difference chart was confusing because it showed only one bar direction per business type. The chart was revised to use paired bars so readers can see both selected regions' shares directly.

Improvements made:

- Replaced the one-sided difference presentation with paired bars.
- Kept percentages as the comparison metric.
- Added tooltips with region-specific shares and business counts.
- Added a clearer x-axis label: `Share of each selected region's businesses`.

## Capital Chart Decisions

Several capital chart ideas were tested and then removed or revised:

- A median capital explanation chart was added to explain why median capital is 15,000 ETB.
- A waterfall chart was considered for capital distribution.
- The waterfall/distribution view was judged confusing and removed.
- A sector capital composition chart was tested.
- The sector capital composition chart was removed after the treemap became the clearer capital view.

The current capital story is focused on the Capital Concentration treemap.

## Capital Concentration Treemap

The Capital Concentration chart is now the lead capital composition view.

Purpose:

- Show which sector/business-type combinations account for reported capital.
- Help readers spot concentration and dominance.
- Allow comparison between the full registry and a selected region.

Current behavior:

- Uses `sectorCapitalComposition` for the full registry.
- Uses `regionCapitalComposition` when a region is selected.
- Colors tiles by sector.
- Labels tiles by business type when there is enough space.
- Uses tooltips for exact values and interpretation.
- Includes all currently available sector/business-type categories from the prepared data.
- Uses a compressed display scale so small categories remain visible.
- Keeps actual ETB values in labels and tooltips.
- Is scrollable when the chart requires more vertical space.

Important implementation detail:

The treemap visual area is intentionally scale-compressed. This means tile area is not a strict linear representation of ETB. The exact capital values are shown in labels and tooltips. The compression was added because the largest logistics category was visually dominating the chart and hiding smaller categories.

## Treemap Readability Improvements

The treemap went through several design refinements:

- Changed from a nested sector layout to flat sector/business-type tiles.
- Removed a separate `Largest Capital Areas` section.
- Removed a generated explanatory paragraph below the chart at the user's request.
- Changed the title to `Capital Concentration`.
- Added a region filter to the chart.
- Removed the older `Sector Capital Composition` chart entirely.
- Removed text that appeared inside small tiles such as `Tile area is balanced so smaller categories remain visible`.
- Removed `.treemap-leaf rect` stroke styling.
- Removed `.treemap-label-backdrop` styling.
- Stopped drawing label backdrop rectangles inside treemap tiles.
- Added clipping so labels cannot spill outside their tile.
- Added minimum tile-size thresholds so labels are not drawn when they would be unreadable.
- Made the chart height depend on the number of available categories.
- Made the chart container scrollable with a maximum height.

## Treemap Tooltip Improvements

The Capital Concentration tooltip was rewritten multiple times to make the numbers clearer.

Earlier tooltip wording was unclear because it said things like:

- `1.2T ETB total capital`
- `60.7% of capital shown in all regions`
- `99.3% of sector capital`

The current tooltip uses clearer labels:

- `Grouped under`
- `Total reported capital`
- `Overall weight`
- `Sector weight`
- `Takeaway`

The takeaway now changes based on actual share:

- If a tile is at least 20% of visible capital, it is described as a main capital concentration.
- If a tile is at least 75% of its sector, it is described as accounting for most of its sector's reported capital.
- If a tile is at least 5% of visible capital or 25% of sector capital, it is described as a meaningful capital pool.
- Otherwise, it is described as a small share shown for completeness.

This fixed the misleading case where a small tile such as `Recreation & Entertainment` was described as one of the larger capital pools.

## General Chart Readability Improvements

Several changes were made to prevent labels, numbers, and tooltips from becoming unreadable:

- Tooltips now reposition inside the browser window instead of running offscreen.
- Horizontal bar labels move inside the bar when the value is close to the chart edge.
- Comparison labels are hidden for very small bars where text would overprint.
- Treemap labels are clipped to their tiles.
- Treemap labels only render when there is enough tile width and height.
- Legends are kept out of chart plotting areas where they would overlap axes.

## Data Quality Work

The Manufacturing section showed incorrect business types, including categories such as `Recreation & Entertainment` and `Food & Beverage Production` appearing under Manufacturing. The correction work used `busi_desc` and `sub_group` to compare against `Primary_Business_Type`.

Created:

`scripts/update_primary_business_type_corrections.py`

Purpose:

- Update Manufacturing records in the source CSV where `Primary_Business_Type` conflicted with the business description.
- Write an audit file showing old and new categories.

Audit output:

`docs/manufacturing_primary_type_corrections.csv`

Rows changed:

- 13,004 Manufacturing rows

Manufacturing correction categories include:

- `Healthcare Manufacturing`
- `Food & Beverage Manufacturing`
- `Textile & Leather Manufacturing`
- `Furniture, Wood & Paper Manufacturing`
- `Electronics & Equipment Manufacturing`
- `Transport Equipment Manufacturing`
- `Consumer Goods Manufacturing`
- `Industrial & Materials Manufacturing`
- `Other Manufacturing`

The data-preparation script also includes a `corrected_primary_type(row)` function so Manufacturing labels remain consistently corrected when data is prepared.

## Full Primary Business Type Audit

After the Manufacturing correction, a broader audit was created to look for other likely mislabeled `Primary_Business_Type` values.

Created:

`scripts/audit_primary_business_type_mislabels.py`

Purpose:

- Compare `Primary_Business_Type` to `sector`, `busi_desc`, and `sub_group`.
- Suggest replacements only for high-confidence text matches.
- Write both CSV and Markdown audit outputs.

Initial high-confidence issues found before applying corrections:

- 55,236 Department stores retail trade records: `Food & Grocery` suggested to become `General Consumer Goods`.
- 833 Special houses retail trade records: `Agriculture Retail` suggested to become `General Consumer Goods`.
- 630 Agriculture crop growing records: `Industrial & Materials` suggested to become `Agriculture`.
- 242 Tourism and Arts tour operator records: `Professional & General Services` suggested to become `Toursim and Arts`.
- 210 Logistics telecom/postal records: `Professional & General Services` suggested to become `Logistics & Transportation`.

Created:

`scripts/apply_primary_business_type_audit_corrections.py`

Purpose:

- Apply the approved high-confidence audit corrections to the source CSV.
- Save a row-level correction audit.

Audit output:

`docs/primary_business_type_applied_corrections.csv`

Rows changed:

- 57,151 rows

After applying the corrections, the audit summary shows:

- Potentially mislabeled records found: 0

Current audit files:

- `docs/primary_business_type_mislabel_audit.csv`
- `docs/primary_business_type_mislabel_audit.md`
- `docs/primary_business_type_applied_corrections.csv`
- `docs/manufacturing_primary_type_corrections.csv`

## Documentation Created

Documentation files now include:

- `README.md` - workspace overview.
- `docs/data_inventory.md` - source file inventory and observed columns.
- `docs/visualization_plan.md` - project goal, users, stack, visualization choices, and next improvements.
- `docs/primary_business_type_mislabel_audit.md` - current audit summary.
- `docs/work_completed_so_far.md` - this work log.

## Current Local Preview

The website has been previewed locally at:

`http://localhost:8008/`

Recent checks confirmed the local page returns:

`200 OK`

## Validation Performed

Validation checks used during development:

- JavaScript syntax checks with `node --check profile-visualization/app.js`.
- Whitespace checks with `git diff --check`.
- Local server response checks with `Invoke-WebRequest -UseBasicParsing http://localhost:8008/`.
- JSON inspection with Node.js to confirm generated aggregate totals.
- CSV row counts for correction audit files.

Recent checks passed:

- JavaScript syntax check.
- Git whitespace diff check.
- Local page response check.

## Current Known Issues and Cautions

- The current filesystem listing shows `All_business_2016_DeepTaxonomy.csv` as `0` bytes even though previous documentation and the generated JSON indicate it was previously populated. The project should not rebuild `business_landscape.json` from this CSV until the source file is restored.
- The generated treemap data currently includes 32 sector/business-type tiles. This comes from the prepared aggregate JSON, not from a fresh rebuild.
- The capital treemap uses compressed display sizing for readability, so it should be described as a concentration view rather than a precise area-proportional financial chart.
- The source data contains a typo: `Toursim and Arts`. This spelling appears in the data and has been preserved in outputs unless explicitly corrected elsewhere.
- Some large raw files are intentionally ignored by Git and should remain outside version control.

## Suggested Next Steps

- Restore or verify the populated `All_business_2016_DeepTaxonomy.csv` before running any data-preparation scripts again.
- Add a methodology note to the web page explaining that public outputs are aggregated and privacy-preserving.
- Add a small note near the Capital Concentration chart explaining that tile area is visually compressed while tooltips show exact ETB values.
- Add export buttons for charts if the goal is to attach images to a profile.
- Consider adding a map only if a reliable Ethiopia regional boundary file is available.
- Consider correcting the source spelling `Toursim and Arts` to `Tourism and Arts` if the user wants presentation labels cleaned for public viewing.
