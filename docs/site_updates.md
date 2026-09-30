# Visualization Site Updates

Date: September 1, 2026
Files: `profile-visualization/app.js`, `profile-visualization/styles.css`,
`profile-visualization/index.html`, `scripts/prepare_profile_viz_data.py`

The site is the primary portfolio deliverable; the narrative report complements it. These
changes bring it onto the corrected data and fix three defects found by using the page.

## 1. The prep script was silently reverting corrections

`prepare_profile_viz_data.py` re-derived `Primary_Business_Type` at aggregation time via
`corrected_primary_type()`. That was a workaround from when the source CSV was uncorrected.
Against the now-corrected source it would have **silently changed 856 records** — sending the
216 Software Development records back to "Other Manufacturing", and leaving 611 recycling
records with a type contradicting their own specialty.

The source CSV is now the single authority: aggregation reads the label as filed. The
function is kept (the correction scripts import it) but is no longer applied during
aggregation.

## 2. Chart colours were failing colour-blind separation

The original palette was four brand colours plus four eyeballed muted tones. Measured against
the card surface `#fffdf8`:

| Check | Original | Now |
| --- | --- | --- |
| Chroma floor | **FAIL** — 6 of 8 below floor, read as gray | PASS |
| CVD separation | **FAIL** — worst adjacent ΔE 2.4 | PASS — ΔE 8.5 |
| Normal-vision floor | **FAIL** — ΔE 5.8 | PASS — ΔE 16.8 |
| Lightness band | PASS | PASS |
| Contrast vs surface | PASS | PASS |

Two treemap sectors were effectively the same colour even for full-colour vision.

The replacement keeps the site's muted earth character — deep green, ochre, muted blue,
brick, violet, olive, plum, dark gold — and clears all five checks with no WARNs. The key
insight: the original tones were muted by *draining chroma*, which is what pushed six of them
below the gray threshold. These stay muted by sitting **deep in lightness** instead, so they
read as earth tones without becoming indistinguishable.

A first attempt used a brighter validated default set. It passed the checks but clashed with
the page's restrained aesthetic, so it was replaced rather than kept — correctness and the
existing visual identity are both requirements, not a trade-off.

Palette is defined as `--series-1..8` in `styles.css`. **Slot order is the colour-blind-safety
mechanism** — assign in sequence, never reorder or cycle. The brand green/gold/clay/blue
remain in the page chrome (rules, headings, accents).

Also fixed: each chart previously built its own `scaleOrdinal` over whatever data was on
screen, so **filtering to a region repainted the surviving sectors**. There is now one
`sectorColorScale` built once from the full dataset, shared by the donut, treemap and
comparison chart. Colour follows the sector, not its rank.

## 3. The treemap trapped the page scroll

`.treemap-chart` had `max-height: 680px; overflow-y: auto`. Because the chart spans most of
the page width, scrolling with the cursor anywhere over it stopped the page — the page read
as frozen. The inner scroller is gone; the treemap sizes to its content and the page scrolls
normally.

Note for future edits: making grid panels flex-fill their charts **breaks this chart**. It
sizes itself from its content, so a `flex: 1 1 0` box forces its SVG to overflow and paint
over the sections below. The fill behaviour is deliberately scoped to `.panel-fill`, used
only on the Sector Mix card.

## 4. The sector donut was adrift in a large card

Two compounding causes: the card stretches to its taller grid neighbour (the ten-bar business
type chart), and the donut reserved up to 150px per side for labels — which squeezed the
radius down to its 64px floor. The chart now fills the card height (`.panel-fill`) and the
label gutter is capped at 112px, so the ring uses the space available. Labels already
shorten themselves to fit.

## 5. Rollup label disambiguated

`capital_composition()` buckets business types beyond the top 6 per sector into a residual
tile. It was labelled "Other" — confusing now that "Other" has been eliminated as a real
taxonomy category. Renamed **"Other types"** so it reads as a presentation rollup.

## Verification

Re-rendered and inspected every section in the browser: no console errors, page scrolls
throughout, corrected categories present (`Agricultural Production`, `Construction
Contracting`, `Real Estate & Property`, `IT & Software Services`, `Mining & Quarrying`),
`Partnership` and `Tourism and Arts` spelled correctly, and no bare "Other" tile anywhere.
Totals unchanged at 345,369 with median capital 15,000.

---

# Three New Views (September 1, 2026)

Added alongside the existing five. Aggregates added to `prepare_profile_viz_data.py`;
payload grew from 205 KB to 343 KB.

## Who Owns These Businesses

`legalStatuses` was in the JSON but had no chart anywhere on the page, despite being the
project's headline finding. Sole-proprietor share by macro sector turns out to be a clean
gradient, not a flat 85%:

| Macro sector | Businesses | Sole proprietor |
| --- | ---: | ---: |
| Retail | 180,426 | 89.8% |
| Services | 105,144 | 89.8% |
| Hospitality | 24,731 | 85.9% |
| Manufacturing | 12,824 | 62.4% |
| Agriculture | 10,820 | 50.8% |
| Construction | 10,755 | 35.7% |
| Extractive | 669 | 17.8% |

Formality scales with capital intensity across all seven sectors — a stronger claim than
"Manufacturing is the exception", and only visible because the taxonomy fixes created the
Construction, Agriculture and Extractive sectors in the first place.

## The Formality Ladder

Median registered capital by legal form, log scale, with a 25th–75th percentile range:
Partnership 6,000 → Private 15,000 → Cooperative 50,000 → Private Limited Company 300,000 →
Share Company 800,000 → Public Enterprise 6,000,000 ETB. A thousand-fold span, which is why
the axis is logarithmic — linear flattens the whole informal end into a single tick.

Legal forms with fewer than 20 records are suppressed rather than shown as noise.

## Inside the Regions — geography drilldown

The registry has three geographic levels and the site was using one. Region → **zone (134)** →
**woreda (1,161)**, with a breadcrumb back up. Oromia alone has 47 zones. `visualization_plan.md`
listed a map as a next step but flagged it as blocked on finding a reliable GeoJSON; a
drilldown delivers the same insight with no external dependency.

## What Businesses Actually Do — taxonomy drilldown

Macro sector → business type → `Business_Specialty` (75 values), the tier that had never been
exported. Construction Contracting resolves into Building Contractor 3,691, General Contractor
2,789, Road Works 1,875, Finishing & Fit-Out 947, Water Works 946, Electrical &
Electromechanical 280, Site Preparation 227.

## Implementation notes

Both drilldowns share one `drawDrilldown()` function; each level supplies its own rows,
colour, and tooltip resolver. Adding a fourth tier means adding a level object, not another
chart.

Four issues found by using the page rather than reading the code:

- A stale tooltip hung over the new level after drilling — `hideTooltip()` on navigate.
- Legal-form labels were clipped at the left edge ("…e Man Private Limited Company") — wider
  left margin plus end-ellipsis.
- Levels with one child stretched a single bar over the full plot height — bar thickness is
  now capped at 34px and centred in its band.
- The breadcrumb wrapped raggedly on the third level — right-aligned with a max width.

Verified: no console errors, all three levels of both drilldowns navigate correctly in both
directions, totals reconcile (345,369).

---

# Unified Filter and Chart Explanations (September 1, 2026)

## The problem, measured

Before this pass, of ten views on the page:

| | Global region | Global sector |
| --- | --- | --- |
| Summary cards | yes | yes |
| Region ranking | n/a | yes |
| Sector mix | yes | no |
| Top business types | yes | yes |
| Capital concentration | **own selector** | no |
| Who Owns These Businesses | **no** | no |
| Formality Ladder | **no** | no |
| Zone drilldown | **no** | n/a |
| Specialty drilldown | **no** | no |
| Compare Two Regions | **own selectors** | no |

Five views ignored the controls entirely and there were four separate filter controls on one
page. Nothing told the reader which was which.

## One filter

Region now drives **every** chart. This needed three new region-scoped aggregates
(`legalStatusByRegion`, `capitalByLegalFormByRegion`, `specialtyHierarchyByRegion`); payload
grew from 343 KB to 591 KB.

The capital treemap's private region selector is gone, folded into the global one. The filter
bar is sticky, so it stays reachable on a 7,400px page, and gains a "Clear filters" button
that appears only when a filter is active. The status line reads in plain numbers —
"Showing 153 Manufacturing businesses in Somali."

Selecting a region also **opens the geography drilldown at that region**, so the filter and
the drilldown agree instead of contradicting each other.

## Sector applies where it makes sense — and says where it does not

Sector cannot sensibly filter every chart: filtering the sector-mix donut by one sector leaves
a single slice, and the formality chart *is* a breakdown by sector. Rather than let those
silently ignore the control, every chart now carries a scope note stating what the active
filter is doing to it. With region Somali and sector Manufacturing:

- Region ranking — "Ranked by Manufacturing registrations only. Still showing every region, so you can see where Somali sits against the rest."
- Sector mix — "Sector mix within Somali. The sector filter does not apply here — it would leave a single slice."
- Capital concentration — "Capital registered in Somali. Not filtered by sector — every sector is shown so the comparison holds."
- Who Owns These Businesses — "Legal structure of businesses in Somali. The sector filter does not apply — this chart is itself a breakdown by sector."

The comparison section keeps its own two selectors and is explicitly marked as independent,
in a differently-coloured note.

## Descriptions

Every chart now has a one-line subject, a "how to read" paragraph covering the encoding, and
the live scope note. The two non-obvious encodings are called out directly: the treemap's
**compressed tile area** ("compare the printed values, not the rectangles") and the formality
ladder's **logarithmic axis** ("each gridline is ten times the last").

## The freeze, and what it actually was

Selecting a region locked the renderer. Three hypotheses were wrong before the right one:

1. `backdrop-filter: blur()` on the sticky bar — replaced with a solid background. Still froze.
2. `position: sticky` itself — disabled it. Still froze.
3. A resize feedback loop — guarded anyway (see below). Still froze.

Measuring the DOM settled it: 1,097 nodes, 847 SVG elements, 7,409px tall — nothing heavy.
Scrolling via `window.scrollTo` worked perfectly. **The page was never frozen**; large
synthetic wheel scrolls from the automation tool were timing out screenshot capture. A real
defect was never there.

The resize guard is kept regardless, because the loop it prevents is real: a redraw changes
chart heights, which changes page height, which toggles the scrollbar, which fires resize,
which redraws. Now the handler is debounced and only fires when window **width** changes.

Lesson worth keeping: measure before theorising. Three CSS properties were changed on
suspicion before anyone counted the DOM nodes.
