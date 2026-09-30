import csv
import json
import math
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "All_business_2016_DeepTaxonomy.csv"
OUT_DIR = ROOT / "profile-visualization" / "data"
OUT_FILE = OUT_DIR / "business_landscape.json"


def clean(value):
    value = (value or "").strip()
    return value if value else "Unknown"


def parse_capital(value):
    try:
        number = float((value or "").replace(",", "").strip())
    except ValueError:
        return None
    if not math.isfinite(number) or number < 0:
        return None
    return number


def corrected_primary_type(row):
    """Legacy Manufacturing relabelling, kept for the correction scripts that import it.

    NOT applied during aggregation any more. The source CSV is now the single authority on
    category labels: corrections are applied to it by
    scripts/apply_primary_business_type_audit_corrections.py and
    scripts/apply_taxonomy_category_fixes.py. Re-deriving here silently reverted 856 rows —
    sending Software Development back to "Other Manufacturing" and leaving recycling records
    with a Primary_Business_Type that contradicted their own Business_Specialty.
    """
    sector = clean(row.get("sector"))
    primary = clean(row.get("Primary_Business_Type"))
    if sector != "Manufacturing":
        return primary

    text = f"{row.get('busi_desc') or ''} {row.get('sub_group') or ''}".lower()

    if any(term in text for term in ["pharmaceutical", "medical instrument", "medical instruments"]):
        return "Healthcare Manufacturing"
    if any(term in text for term in ["food", "beverage", "bakery", "coffee", "tea", "dairy", "meat", "tobacco"]):
        return "Food & Beverage Manufacturing"
    if any(term in text for term in ["textile", "apparel", "leather"]):
        return "Textile & Leather Manufacturing"
    if any(term in text for term in ["furniture", "wood", "paper"]):
        return "Furniture, Wood & Paper Manufacturing"
    if any(term in text for term in ["communication", "electrical", "computer", "photographic", "optical", "measuring"]):
        return "Electronics & Equipment Manufacturing"
    if any(term in text for term in ["ship", "boat", "railway", "tramway", "vehicle", "transport"]):
        return "Transport Equipment Manufacturing"
    if any(term in text for term in ["souvenir", "artifact", "jewel", "recreational equipment"]):
        return "Consumer Goods Manufacturing"
    if any(
        term in text
        for term in [
            "mineral",
            "metal",
            "steel",
            "concrete",
            "cement",
            "plaster",
            "granite",
            "chemical",
            "cosmotic",
            "cosmetic",
            "cleaning",
            "gas production",
            "steam",
            "coke oven",
            "machinery",
            "ammunition",
        ]
    ):
        return "Industrial & Materials Manufacturing"
    if "manufactur" in text or "manufctur" in text:
        return "Other Manufacturing"
    return primary


def pct(values, q):
    if not values:
        return 0
    idx = round((len(values) - 1) * q)
    return values[max(0, min(idx, len(values) - 1))]


def top_items(counter, limit):
    return [{"name": name, "count": count} for name, count in counter.most_common(limit)]


def capital_composition(counter, total, limit=6):
    top = sorted(counter.items(), key=lambda item: item[1], reverse=True)[:limit]
    rows = [{"type": name, "totalCapital": round(value, 2)} for name, value in top]
    other = total - sum(value for _, value in top)
    if other > 0:
        # Rollup of the business types beyond the top N for this sector - a
        # presentation bucket, not a taxonomy category. Named explicitly so it is
        # not mistaken for a real "Other" class in the data.
        rows.append({"type": "Other types", "totalCapital": round(other, 2)})
    return rows


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    total = 0
    sectors = Counter()
    macro_sectors = Counter()
    primary_types = Counter()
    regions = Counter()
    legal_statuses = Counter()
    region_sector = defaultdict(Counter)
    region_primary = defaultdict(Counter)
    sector_region = defaultdict(Counter)
    sector_primary = defaultdict(Counter)
    region_sector_primary = defaultdict(lambda: defaultdict(Counter))
    capital_total_by_primary = defaultdict(float)
    capital_total_by_sector = defaultdict(float)
    capital_total_by_sector_primary = defaultdict(lambda: defaultdict(float))
    capital_total_by_region_sector = defaultdict(lambda: defaultdict(float))
    capital_total_by_region_sector_primary = defaultdict(lambda: defaultdict(lambda: defaultdict(float)))
    capital_values_by_primary = defaultdict(list)
    capital_values_by_sector_primary = defaultdict(lambda: defaultdict(list))
    capital_by_sector = defaultdict(list)
    capital_by_region = defaultdict(list)
    capital_by_region_sector = defaultdict(lambda: defaultdict(list))
    capital_values = []
    # Formality: legal structure by macro sector, and capital by legal form.
    legal_by_macro = defaultdict(Counter)
    capital_by_legal = defaultdict(list)
    # Geography below region: region -> zone -> woreda.
    zone_counts = defaultdict(Counter)
    woreda_counts = defaultdict(lambda: defaultdict(Counter))
    zone_capital = defaultdict(lambda: defaultdict(list))
    # Fourth taxonomy tier: macro sector -> primary type -> specialty.
    specialty_tree = defaultdict(lambda: defaultdict(Counter))
    # Region-scoped copies so the global region filter can drive every view, not
    # just the three it originally reached.
    legal_by_macro_region = defaultdict(lambda: defaultdict(Counter))
    capital_by_legal_region = defaultdict(lambda: defaultdict(list))
    specialty_tree_region = defaultdict(lambda: defaultdict(lambda: defaultdict(Counter)))

    with SOURCE.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            total += 1
            sector = clean(row.get("sector"))
            macro = clean(row.get("Macro_Sector"))
            primary = clean(row.get("Primary_Business_Type"))
            region = clean(row.get("region"))
            legal = clean(row.get("legal_status_name"))
            capital = parse_capital(row.get("capital"))

            sectors[sector] += 1
            macro_sectors[macro] += 1
            primary_types[primary] += 1
            regions[region] += 1
            legal_statuses[legal] += 1
            region_sector[region][sector] += 1
            region_primary[region][primary] += 1
            sector_region[sector][region] += 1
            sector_primary[sector][primary] += 1
            region_sector_primary[region][sector][primary] += 1

            zone = clean(row.get("zone"))
            woreda = clean(row.get("woreda"))
            specialty = clean(row.get("Business_Specialty"))
            legal_by_macro[macro][legal] += 1
            zone_counts[region][zone] += 1
            woreda_counts[region][zone][woreda] += 1
            specialty_tree[macro][primary][specialty] += 1
            legal_by_macro_region[region][macro][legal] += 1
            specialty_tree_region[region][macro][primary][specialty] += 1
            if capital is not None:
                capital_by_legal[legal].append(capital)
                capital_by_legal_region[region][legal].append(capital)
                zone_capital[region][zone].append(capital)

            if capital is not None:
                capital_values.append(capital)
                capital_by_sector[sector].append(capital)
                capital_by_region[region].append(capital)
                capital_by_region_sector[region][sector].append(capital)
                capital_total_by_primary[primary] += capital
                capital_total_by_sector[sector] += capital
                capital_total_by_sector_primary[sector][primary] += capital
                capital_total_by_region_sector[region][sector] += capital
                capital_total_by_region_sector_primary[region][sector][primary] += capital
                capital_values_by_primary[primary].append(capital)
                capital_values_by_sector_primary[sector][primary].append(capital)

    capital_values.sort()
    capital_summary = {
        "recordsWithCapital": len(capital_values),
        "min": pct(capital_values, 0),
        "p25": pct(capital_values, 0.25),
        "median": pct(capital_values, 0.5),
        "p75": pct(capital_values, 0.75),
        "p90": pct(capital_values, 0.9),
        "p99": pct(capital_values, 0.99),
    }

    sector_capital = []
    for sector, values in capital_by_sector.items():
        values.sort()
        sector_capital.append(
            {
                "sector": sector,
                "count": len(values),
                "median": pct(values, 0.5),
                "p75": pct(values, 0.75),
                "p90": pct(values, 0.9),
            }
        )
    sector_capital.sort(key=lambda item: item["count"], reverse=True)

    region_capital = []
    for region, values in capital_by_region.items():
        values.sort()
        region_capital.append(
            {
                "region": region,
                "count": len(values),
                "median": pct(values, 0.5),
                "p75": pct(values, 0.75),
                "p90": pct(values, 0.9),
            }
        )
    region_capital.sort(key=lambda item: regions[item["region"]], reverse=True)

    region_profiles = []
    for region, count in regions.most_common():
        mix = top_items(region_sector[region], len(sectors))
        top_primary = top_items(region_primary[region], 14)
        by_sector = {}
        for sector, sector_count in region_sector[region].most_common():
            by_sector[sector] = {
                "count": sector_count,
                "topBusinessTypes": top_items(region_sector_primary[region][sector], 8),
            }
        region_profiles.append(
            {
                "region": region,
                "count": count,
                "sectorMix": mix,
                "topBusinessTypes": top_primary,
                "bySector": by_sector,
            }
        )

    sector_profiles = []
    for sector, count in sectors.most_common():
        sector_profiles.append(
            {
                "sector": sector,
                "count": count,
                "topRegions": top_items(sector_region[sector], len(regions)),
                "topBusinessTypes": top_items(sector_primary[sector], 10),
            }
        )

    business_type_capital_totals = []
    for primary, total_capital in capital_total_by_primary.items():
        values = capital_values_by_primary[primary]
        values.sort()
        business_type_capital_totals.append(
            {
                "type": primary,
                "count": primary_types[primary],
                "recordsWithCapital": len(values),
                "totalCapital": round(total_capital, 2),
                "medianCapital": pct(values, 0.5),
            }
        )
    business_type_capital_totals.sort(key=lambda item: item["totalCapital"], reverse=True)

    sector_business_type_capital_totals = {}
    for sector, _ in sectors.most_common():
        rows = []
        for primary, total_capital in capital_total_by_sector_primary[sector].items():
            values = capital_values_by_sector_primary[sector][primary]
            values.sort()
            rows.append(
                {
                    "type": primary,
                    "count": sector_primary[sector][primary],
                    "recordsWithCapital": len(values),
                    "totalCapital": round(total_capital, 2),
                    "medianCapital": pct(values, 0.5),
                }
            )
        rows.sort(key=lambda item: item["totalCapital"], reverse=True)
        sector_business_type_capital_totals[sector] = rows

    sector_capital_composition = []
    for sector, total_capital in capital_total_by_sector.items():
        sector_capital_composition.append(
            {
                "sector": sector,
                "count": sectors[sector],
                "recordsWithCapital": len(capital_by_sector[sector]),
                "totalCapital": round(total_capital, 2),
                "businessTypes": capital_composition(
                    capital_total_by_sector_primary[sector],
                    total_capital,
                ),
            }
        )
    sector_capital_composition.sort(key=lambda item: item["totalCapital"], reverse=True)

    region_capital_composition = {}
    for region, sectors_for_region in capital_total_by_region_sector.items():
        rows = []
        for sector, total_capital in sectors_for_region.items():
            rows.append(
                {
                    "sector": sector,
                    "count": region_sector[region][sector],
                    "recordsWithCapital": len(capital_by_region_sector[region][sector]),
                    "totalCapital": round(total_capital, 2),
                    "businessTypes": capital_composition(
                        capital_total_by_region_sector_primary[region][sector],
                        total_capital,
                    ),
                }
            )
        rows.sort(key=lambda item: item["totalCapital"], reverse=True)
        region_capital_composition[region] = rows

    # Disclosure control. A median computed over one business IS that business's
    # registered capital, so publishing it discloses individual financial data
    # through something labelled an aggregate. Five region-sector cells sat below
    # this threshold, one of them a single business. Counts are kept - they say
    # how many exist, not what any one of them is worth - but the capital
    # statistics are withheld.
    MIN_CELL = 5

    region_sector_capital = {}
    for region, sectors_for_region in capital_by_region_sector.items():
        region_sector_capital[region] = {}
        for sector, values in sectors_for_region.items():
            values.sort()
            cell = {"count": len(values)}
            if len(values) >= MIN_CELL:
                cell["median"] = pct(values, 0.5)
                cell["p75"] = pct(values, 0.75)
                cell["p90"] = pct(values, 0.9)
            else:
                cell["suppressed"] = True
            region_sector_capital[region][sector] = cell

    # Legal structure by macro sector, as counts plus the sole-proprietor share that
    # is the headline of the formality story.
    legal_status_by_macro = []
    for macro, counts in sorted(legal_by_macro.items(), key=lambda kv: -sum(kv[1].values())):
        tot = sum(counts.values())
        legal_status_by_macro.append({
            "macroSector": macro,
            "count": tot,
            "soleProprietorShare": round(counts.get("Private", 0) / tot, 4) if tot else 0,
            "statuses": [{"name": n, "count": c} for n, c in counts.most_common()],
        })

    # Median capital by legal form - the ladder from informal to incorporated.
    capital_by_legal_form = []
    for legal, values in sorted(capital_by_legal.items(), key=lambda kv: -len(kv[1])):
        if len(values) < 20:          # suppress thin categories rather than show noise
            continue
        values.sort()
        capital_by_legal_form.append({
            "name": legal,
            "count": len(values),
            "median": pct(values, 0.5),
            "p25": pct(values, 0.25),
            "p75": pct(values, 0.75),
        })

    # Geography below region. Woredas are name+count only to keep the payload small.
    zone_profiles = {}
    for region, zones in zone_counts.items():
        rows = []
        for zone, count in zones.most_common():
            vals = sorted(zone_capital[region][zone])
            rows.append({
                "zone": zone,
                "count": count,
                "medianCapital": pct(vals, 0.5) if vals else 0,
                "woredas": [{"name": w, "count": c}
                            for w, c in woreda_counts[region][zone].most_common()],
            })
        zone_profiles[region] = rows

    # Fourth taxonomy tier.
    specialty_hierarchy = []
    for macro, types in sorted(specialty_tree.items(), key=lambda kv: -sum(sum(c.values()) for c in kv[1].values())):
        type_rows = []
        for ptype, specs in sorted(types.items(), key=lambda kv: -sum(kv[1].values())):
            type_rows.append({
                "name": ptype,
                "count": sum(specs.values()),
                "specialties": [{"name": n, "count": c} for n, c in specs.most_common()],
            })
        specialty_hierarchy.append({
            "macroSector": macro,
            "count": sum(r["count"] for r in type_rows),
            "businessTypes": type_rows,
        })

    def legal_rows(by_macro):
        out = []
        for macro, counts in sorted(by_macro.items(), key=lambda kv: -sum(kv[1].values())):
            tot = sum(counts.values())
            out.append({
                "macroSector": macro,
                "count": tot,
                "soleProprietorShare": round(counts.get("Private", 0) / tot, 4) if tot else 0,
                "statuses": [{"name": n, "count": c} for n, c in counts.most_common()],
            })
        return out

    def legal_capital_rows(by_legal, floor):
        out = []
        for legal, values in sorted(by_legal.items(), key=lambda kv: -len(kv[1])):
            if len(values) < floor:
                continue
            values.sort()
            out.append({"name": legal, "count": len(values), "median": pct(values, 0.5),
                        "p25": pct(values, 0.25), "p75": pct(values, 0.75)})
        return out

    def specialty_rows(tree):
        out = []
        for macro, types in sorted(tree.items(), key=lambda kv: -sum(sum(c.values()) for c in kv[1].values())):
            type_rows = []
            for ptype, specs in sorted(types.items(), key=lambda kv: -sum(kv[1].values())):
                type_rows.append({"name": ptype, "count": sum(specs.values()),
                                  "specialties": [{"name": n, "count": c} for n, c in specs.most_common()]})
            out.append({"macroSector": macro, "count": sum(r["count"] for r in type_rows),
                        "businessTypes": type_rows})
        return out

    legal_status_by_region = {r: legal_rows(v) for r, v in legal_by_macro_region.items()}
    # A lower floor per region: a threshold tuned to the national set would drop
    # every legal form in the smaller regions.
    capital_by_legal_by_region = {r: legal_capital_rows(v, 5) for r, v in capital_by_legal_region.items()}
    specialty_by_region = {r: specialty_rows(v) for r, v in specialty_tree_region.items()}

    # Share of businesses against share of capital, per sector. The two diverge
    # sharply - logistics is a seventh of the register and well over half its
    # capital - so the ratio between them is carried explicitly rather than left
    # for the page to derive.
    sector_capital_totals = {
        row["sector"]: sum(t["totalCapital"] for t in row["businessTypes"])
        for row in sector_capital_composition
    }
    grand_capital = sum(sector_capital_totals.values()) or 1
    sector_counts = dict(sectors)
    sector_capital_share = []
    for sector, count in sorted(sector_counts.items(), key=lambda kv: -kv[1]):
        cap = sector_capital_totals.get(sector, 0.0)
        count_share = count / total if total else 0.0
        capital_share = cap / grand_capital
        sector_capital_share.append({
            "sector": sector,
            "count": count,
            "countShare": round(count_share, 5),
            "totalCapital": round(cap, 2),
            "capitalShare": round(capital_share, 5),
            "ratio": round(capital_share / count_share, 3) if count_share else 0.0,
        })

    payload = {
        "metadata": {
            "title": "Ethiopia Business Landscape",
            "source": "All_business_2016_DeepTaxonomy.csv",
            "records": total,
            "privacyNote": "The visualization exports aggregated counts only; names and phone numbers are not included.",
        },
        "summary": {
            "totalBusinesses": total,
            "regions": len(regions),
            "sectors": len(sectors),
            "primaryBusinessTypes": len(primary_types),
        },
        "topSectors": top_items(sectors, 12),
        "topMacroSectors": top_items(macro_sectors, 10),
        "topPrimaryTypes": top_items(primary_types, 14),
        "topRegions": top_items(regions, 14),
        "legalStatuses": top_items(legal_statuses, 10),
        "capitalSummary": capital_summary,
        "capitalBySector": sector_capital,
        "capitalByRegion": region_capital,
        "capitalByRegionSector": region_sector_capital,
        "regionProfiles": region_profiles,
        "sectorProfiles": sector_profiles,
        "businessTypeCapitalTotals": business_type_capital_totals,
        "sectorBusinessTypeCapitalTotals": sector_business_type_capital_totals,
        "sectorCapitalComposition": sector_capital_composition,
        "regionCapitalComposition": region_capital_composition,
        "legalStatusByMacroSector": legal_status_by_macro,
        "capitalByLegalForm": capital_by_legal_form,
        "zoneProfiles": zone_profiles,
        "specialtyHierarchy": specialty_hierarchy,
        "legalStatusByRegion": legal_status_by_region,
        "capitalByLegalFormByRegion": capital_by_legal_by_region,
        "specialtyHierarchyByRegion": specialty_by_region,
        "sectorCapitalShare": sector_capital_share,
    }

    OUT_FILE.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {OUT_FILE}")
    print(f"Aggregated {total:,} records")


if __name__ == "__main__":
    main()
