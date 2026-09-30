# Project Brief: Ethiopian Enterprise 2016 — Data Visualization Report

**Purpose of this file:** Handoff context for continuing this project in Cowork. Read this in full before doing any work — it contains the data findings, the approved plan, and specific execution instructions. Do not re-explore the data from scratch or re-propose a plan; confirm the plan below with the user only if something is ambiguous, then build.

---

## 1. Goal

Teddy wants a **data visualization deliverable that showcases three skills at once**: creative/visual design, analytical depth, and writing — using a real dataset. This is portfolio/presentation-oriented, not a purely technical analysis. Approach should be deliberate: data has already been explored and a plan has already been proposed and approved. **Proceed to build — do not restart planning from zero.**

## 2. Source data

File: `All_business_2016_DeepTaxonomy.csv` (also referenced as located at `/mnt/user-data/uploads/` in the originating session — re-upload or locate in Cowork's file space if not already present).

- **345,369 rows, 18 columns.** Business registry for Ethiopia, 2016.
- Columns: `legal_status_name, busi_name, capital, mgr_fname, mgr_mname, mgr_lname, mgr_phone, sub_group, house_num, busi_phone, region, zone, woreda, busi_desc, sector, Macro_Sector, Primary_Business_Type, Business_Specialty`
- Geographic hierarchy: `region` (14 unique) → `zone` (134) → `woreda`
- Industry hierarchy: `sector` (8) → `Macro_Sector` (5: Retail, Services, Other, Hospitality, Manufacturing) → `Primary_Business_Type` (30) → `Business_Specialty` (22)
- `capital` is numeric (birr), extremely skewed: median ≈ 15,000; mean ≈ 6.16M; max ≈ 1.005 trillion. Treat as log-scale for any distribution chart, and note top outliers are large state enterprises (see below).
- Missingness is negligible (0% on all columns except `mgr_lname` at 5.5%, which is irrelevant to the report).

### ⚠️ PII handling — mandatory
Columns `mgr_fname`, `mgr_mname`, `mgr_lname`, `mgr_phone`, `busi_phone`, and `busi_name` contain personally identifiable / individually identifying business data. **Never surface individual names, phone numbers, or single business names in any visual, table, or caption in the final report.** All visuals must use aggregated/grouped data only. Exception: named large state-owned enterprises (e.g., "Ethiopian Construction Works Corporation") may be referenced only if independently verifiable as public institutional entities, and only in prose, not pulled directly from the PII-adjacent columns as a "top individuals" list.

### Key findings already established (do not re-derive, just verify if needed)
- **Legal structure:** ~85% of businesses are informal "Private" sole proprietorships (295,066 of 345,369). Formal corporate structures (Private Limited Company, Share Company, etc.) are a small minority.
- **Geography:** Oromia (163,476) and Addis Ababa (75,794) dominate. Gambela has only 175 businesses — steep concentration.
- **Sector mix:** Retail (173,374) >> Services (97,591) > Other (39,856) > Hospitality (24,731) > Manufacturing (9,817, smallest).
- **Largest single specialties:** "Tier 1: Kiosk / Micro-Retail" (52,043) and "Passenger & General Transport" (43,112) — these two alone represent the scale of micro/informal enterprise.
- **Capital vs. sector:** Median capital is highest in Services (50,000) and lowest in Hospitality (5,000) — but means are dominated by outliers in Services and "Other" due to large state enterprises.
- **Capital inequality:** Top-capital entities are dominated by state/parastatal enterprises (e.g., Addis Ababa Light Railway Transport Service Enterprise, Ethiopian Construction Works Corporation, Chemical Industry Corporation) alongside a few individual outliers that may be data-entry anomalies (flag transparently in the report rather than silently excluding).

## 3. Approved narrative structure

Working title: **"The Shape of Ethiopian Enterprise, 2016"**

1. **Scale & Structure** — headline stats (345K businesses); legal structure breakdown (sole prop vs. formal). Framing: "a nation run by individuals, not institutions."
2. **Geography of Enterprise** — regional concentration (Oromia/Addis Ababa dominance vs. Gambela). Visual: bar chart or map-style visualization.
3. **What Ethiopia Does For Work** — hierarchical taxonomy (Sector → Macro_Sector → Primary_Business_Type). Visual: treemap or sunburst. This is the most data/design-rich section.
4. **The Capital Divide** — skewed capital distribution (log scale), state-enterprise outliers, honest note on possible data anomalies at the extreme high end.
5. **Synthesis** — closing visual + 2–3 sentence takeaway tying structure, geography, and capital together.

## 4. Format decision

**Multi-section narrative report** (confirmed with user) — combines written narrative with embedded custom visuals as a single cohesive scrollable piece. Build as an HTML artifact (or docx if the user asks for a downloadable Word version instead — confirm which if unclear). Use custom SVG/chart visuals rather than default library chart styling where possible, to support the "creative design" goal — check `/mnt/skills/public/frontend-design/SKILL.md` for design guidance before building.

## 5. Skills to consult before building
- `/mnt/skills/public/frontend-design/SKILL.md` — for visual/design direction on the HTML report
- `/mnt/skills/public/docx/SKILL.md` — only if user wants a Word version instead of/in addition to HTML
- If charts are built as React/HTML components, standard charting libraries (recharts, d3) are available per the artifact environment.

## 6. Next steps when resuming
1. Confirm the plan above still holds (don't re-ask exploratory questions already answered).
2. Load `frontend-design` SKILL.md.
3. Build section by section: outline → draft each visual + its prose → assemble into one cohesive report.
4. Apply PII rules throughout.
5. Save final deliverable to outputs and present to user.
