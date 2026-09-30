# The Shape of Ethiopian Enterprise — narrative report

Published: September 30, 2026
Artifact: https://claude.ai/artifact/SQdeY3JsCxeG1QnioPduU5

The second of the project's two deliverables, complementary to the interactive site in
`profile-visualization/`. Neither replaces the other: the site is the exploratory piece,
the report is the argued one.

## Spine

The handoff brief proposed scale → geography → what people do → capital → synthesis, built
on "a nation run by individuals, not institutions" (85% sole proprietorships).

The report instead leads with the **formality gradient**, which the taxonomy repair made
visible for the first time:

| Sector | Businesses | Sole proprietor |
| --- | ---: | ---: |
| Retail | 180,426 | 89.8% |
| Services | 105,144 | 89.8% |
| Hospitality | 24,731 | 85.9% |
| Manufacturing | 12,824 | 62.4% |
| Agriculture | 10,820 | 50.8% |
| Construction | 10,755 | 35.7% |
| Extractive | 669 | 17.8% |

Informality is not a flat national condition; it falls monotonically as capital intensity
rises. Paired with median capital by legal form — partnership 6,000 → share company
800,000 ETB, a 133x span — this gives the report a single argument rather than five
observations.

Three of those seven sectors (Agriculture, Construction, Extractive) did not exist as
categories before the taxonomy repair; they were inside the 39,858-record unclassified
bucket. Without that work four of the gradient's seven points are missing, so the data
cleaning is presented as part of the argument rather than a footnote.

## Sections

1. A register of individuals — 295,066 sole proprietorships; 547 share companies
2. Informality is not flat — the gradient (hero chart)
3. What each legal form costs — capital ladder, log scale
4. Two regions hold two thirds — Oromia + Addis 69.3%; Gambela 175; 137 zones, 1,161 woredas
5. An economy of intermediaries — retail + services 82.7%
6. A register with two populations — p25 5,000 → p99 10,000,000 ETB
7. Synthesis, and a note on the data

## Build notes

- Hand-written SVG with coordinates computed from the aggregates, no charting library.
  **Figures are hard-coded** — a data change does not propagate; the SVGs must be recomputed.
- Palette matches the site's muted earth tones, validated for colour-blind separation
  against both the light surface (#f4f5f2) and a dark surface (#14181a); the dark theme uses
  a lightened variant because the light values fall below the dark lightness band.
- Type: Zilla Slab (display) over Source Serif 4 (body), monospaced figures.
- PII rule observed throughout: aggregates only, no business names, owner names or contacts.
- Checked rendered at 1000px and 400px in both themes before publishing; no horizontal
  overflow, no console errors.

## Corrections caught during the write

- Two regions is 69.3%, not 69.2%; retail + services is 82.7%, not 82.6%.
- The caption originally said nine of fourteen regions fall below Amhara. It is eleven.
- Three right-edge value labels ran past the viewBox and were given room.
