# The Shape of Ethiopian Enterprise

An analysis of Ethiopia's 2016 commercial register — 345,369 businesses — delivered as an
interactive visualization and a written report.

**[View the live visualization →](https://teddyumd.github.io/Ethiopia_Trade_Business_Data/)**

The headline finding is not that most Ethiopian businesses are one person, though 85.4% of
them are. It is that informality is **not a flat national condition**. It falls steadily as
capital requirements rise:

| Sector | Businesses | Sole proprietorships |
| --- | ---: | ---: |
| Retail | 180,426 | 89.8% |
| Services | 105,144 | 89.8% |
| Hospitality | 24,731 | 85.9% |
| Manufacturing | 12,824 | 62.4% |
| Agriculture | 10,820 | 50.8% |
| Construction | 10,755 | 35.7% |
| Extractive | 669 | 17.8% |

A kiosk needs a person; a quarry needs a company. Median registered capital by legal form runs
the same way, from 6,000 birr for a partnership to 800,000 for a share company.

Three of the seven sectors above did not exist as categories in the source data. They were
inside an unlabelled residual bucket holding 11.5% of the register, which is why the gradient
had never been visible.

## What's here

| | |
| --- | --- |
| `profile-visualization/` | Static D3 site. Ten views, one filter driving all of them, region→zone→woreda and sector→type→specialty drilldowns. |
| `scripts/` | Data pipeline: rebuild, corrections, aggregation, privacy test. |
| `docs/` | One document per piece of work, each recording what changed and by how much. |

The written report is published separately as an artifact.

## Running it

```bash
# Rebuild the published aggregates from the source CSV
python scripts/prepare_profile_viz_data.py

# Confirm no personal data reaches the published file
python scripts/test_privacy.py

# Serve the site
cd profile-visualization && python -m http.server 8008
```

## Data and its repair

The source is the 2016 commercial register: 345,369 records, 18 fields, covering 14 regions,
137 zones and 1,161 woredas. It arrived needing substantial repair before it could be read.

| Correction | Records | Written up in |
| --- | ---: | --- |
| Unclassified residual given real categories | 39,858 | `docs/taxonomy_category_fixes.md` |
| Business-type mislabels corrected | 57,154 | `docs/busi_desc_taxonomy_comparison.md` |
| Manufacturing records reclassified | 13,004 | `docs/taxonomy_category_fixes.md` |
| Category spellings fixed at source | 34,905 | `docs/taxonomy_label_audit.md` |
| Sector/specialty left stale by earlier passes | 5,812 | `docs/taxonomy_category_fixes.md` |

The enriched file was also rebuilt from scratch after the original was found truncated to 65%
of its records; `docs/taxonomy_rebuild.md` covers how, and how it was verified.

## Privacy

The register carries owner names, manager names and telephone numbers. None of it reaches the
published file, and `scripts/test_privacy.py` enforces that rather than trusting it. The test
checks five things, including one that is easy to miss: a median computed over a handful of
businesses **is** those businesses' data. Capital statistics are withheld for any group below
five businesses — a rule that caught five region-sector cells, one of them a single business
whose registered capital would otherwise have been published.

`Sample.csv` is here to show the raw file's column structure. Its seven identifying columns —
business name, the three manager name fields, both telephone numbers and the house number —
hold placeholders, not the real values they had before this repository was published. The
large source files themselves are excluded by `.gitignore` and never leave the machine.

## Accessibility

Charts are operable by keyboard: drilldown bars take focus and respond to Enter and Space, with
a visible focus ring. Every chart carries a labelled description and a collapsible table of its
underlying figures, so nothing depends on reading the picture. Colours were validated for
colour-blind separation rather than chosen by eye.

## Notes

- `d3.min.js` is vendored rather than loaded from a CDN, so the site runs offline and pins its
  version. It is committed; the site does not render without it.
- Large source files are excluded from Git by `.gitignore` and are kept alongside the repo.
- The site is published from `profile-visualization/` by `.github/workflows/pages.yml`, which
  checks every asset is present and that `app.js` parses before it deploys.

## Licence

The code, scripts and written analysis in this repository are MIT licensed — see `LICENSE`.

That covers my work, not the underlying data. The commercial register is Ethiopian government
data and is not mine to relicense; the raw files are excluded from this repository, and the
only data published here is the aggregated `business_landscape.json`. Anyone reusing the
figures should attribute the register itself, not this repository.
