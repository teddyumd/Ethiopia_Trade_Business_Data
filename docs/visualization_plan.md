# Ethiopia Business Landscape Visualization Plan

## Goal

Create a simple, portfolio-ready interactive website that shows data visualization, data preparation, and civic/business analysis skills without using an overcomplicated stack.

The project answers one core question:

> What does Ethiopia's formal business landscape look like, where is it concentrated, and what kinds of economic activity are most common?

## Intended Users

- Policy makers can compare regional business concentration and identify where business-support services may be needed.
- Investors and banks can spot sector clusters and understand where demand for financial or business services may be concentrated.
- Entrepreneurs can compare competition and opportunity by region or business type.
- Researchers, journalists, and the public can understand the structure of Ethiopia's formal business registry.

## Recommended Stack

- Python for data preparation.
- Standard library CSV processing for the first version, instead of adding dependencies.
- Static HTML, CSS, and JavaScript for the site.
- D3.js for charts and interaction.
- GitHub Pages, Netlify, or another static host for publishing.

This stack is intentionally modest. It demonstrates practical data and web visualization skill at a 2-5 year experience level without requiring a database, backend API, React app, or cloud data warehouse.

## Privacy and Data Handling

The source CSV includes business names, manager names, phone numbers, and location fields. For a public profile project, those fields should not be published record-by-record.

The website uses aggregated data only:

- Counts by region.
- Counts by sector.
- Counts by business type.
- Capital distribution summaries.

Names and phone numbers are excluded from the exported visualization data.

## Steps Taken

1. Inspected the project folder and confirmed the main taxonomy file is `All_business_2016_DeepTaxonomy.csv`.
2. Reviewed the available columns and identified the useful public-facing fields: `region`, `sector`, `Macro_Sector`, `Primary_Business_Type`, `Business_Specialty`, `legal_status_name`, and `capital`.
3. Chose a static website stack because it is easy to explain, easy to host, and appropriate for a portfolio project.
4. Created a Python script at `scripts/prepare_profile_viz_data.py` to aggregate the large CSV into a compact JSON file.
5. Created a static visualization site in `profile-visualization/`.
6. Designed the first version around decision questions: where businesses are concentrated, what sectors dominate, what business types are common, and how registered capital varies.
7. Refined the sector mix chart by moving labels outside the donut and connecting them with leader lines so longer category names remain readable.
8. Added a two-region comparison mode with sector-share bars, business-type difference bars, and a short generated takeaway.
9. Removed the confusing capital percentile chart so the capital story focuses on the clearer Capital Concentration treemap.
10. Revised the overview filters so they change multiple relevant parts of the page instead of only one chart.
11. Tested an alternate sector capital composition chart, then removed it after the treemap became the clearer capital composition view.
12. Added a treemap using capital composition data, then simplified it into flat sector/business-type tiles for readability.
13. Audited Manufacturing records where `Primary_Business_Type` conflicted with `busi_desc`, then added a correction layer in the data-preparation script so Manufacturing uses clearer labels such as `Industrial & Materials Manufacturing`, `Food & Beverage Manufacturing`, and `Textile & Leather Manufacturing`.
14. Updated the source CSV's `Primary_Business_Type` values for Manufacturing records and saved an audit file at `docs/manufacturing_primary_type_corrections.csv` showing each old-to-new category change without names or phone numbers.
15. Audited the full CSV for additional `Primary_Business_Type` mismatches, applied the approved corrections to the source CSV, and saved the full audit trail at `docs/primary_business_type_applied_corrections.csv`.

## Visualization Views

- Dataset summary: high-level counts and median registered capital.
- Regional ranking: shows where formal business registrations are concentrated.
- Sector mix: shows the broad structure of economic activity.
- Business type explorer: changes based on selected region or sector.
- Capital Concentration treemap: uses balanced rectangle area for reported capital across the largest sector/business-type combinations. Tile color identifies the sector, and tile label identifies the business type.
- Region comparison: compares two selected regions using percentages so large and small regions can be evaluated fairly. The business-type comparison uses paired bars so the viewer can see both regions' actual shares, not only the net difference.

## Filter Behavior

The overview filters are intended to answer practical questions, not just decorate the interface.

- Selecting a region updates the summary cards, sector mix, and top business types.
- Selecting a sector updates the summary cards, regional ranking, and top business types.
- Selecting both a region and sector updates the summary cards and top business types for that specific combination, while the regional ranking still shows where that sector appears nationally.
- The Capital Concentration chart has its own region selector so readers can compare the full registry with one selected region.

## Why These Choices

The visualization is designed to be useful, not just attractive. It helps decision makers move from a large spreadsheet to patterns they can act on:

- Concentration: which regions dominate business registration.
- Structure: which sectors and business types are most common.
- Comparison: how places and sectors differ.
- Opportunity: where support, investment, or entrepreneurship may be targeted.

The Capital Concentration treemap is now the lead composition view because it is better suited to quickly spotting large part-to-whole patterns: readers can see which sector/business-type combinations dominate reported capital before moving into more structured comparison. It includes a region filter so the same question can be answered for the full registry or for one selected region. A square-root display scale is applied across all tiles so smaller categories remain readable, while labels and tooltips continue to show actual capital values from the spreadsheet-derived aggregation.

The sector labels were moved outside the donut because direct in-slice labels became difficult to read. Leader lines preserve the connection between each label and slice, while white-backed labels keep text legible over the chart area. The label positions now respond to the available chart width, stay inside the SVG bounds, and shorten long labels only when the card is too narrow to show the full text.

The comparison view uses shares rather than only raw counts because regions vary greatly in dataset size. Raw counts are still shown for context, but percentages make it easier to see whether one region is more specialized in logistics, trade, services, or another business type.

The sector-share legend is rendered as a separate wrapping row below the chart instead of inside the SVG. This keeps the x-axis labels readable and lets the legend adapt when the page width changes.

## Next Improvements

- Add an Ethiopia region map using a reliable GeoJSON boundary file.
- Add downloadable chart images for portfolio sharing.
- Add a short methodology section on the web page.
- Add tests that verify the aggregate JSON does not include personal fields.
