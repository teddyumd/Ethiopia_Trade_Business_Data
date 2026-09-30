"""
Apply category fixes to All_business_2016_DeepTaxonomy.csv, in place.

Fixes three defect classes left by the original enrichment:

  A. Unclassified catch-all. 39,858 records (11.5%) carried Macro_Sector "Other",
     Business_Specialty "Unmapped", and a *sector name* standing in for
     Primary_Business_Type. These are real industries — construction contracting,
     agricultural production, agricultural wholesale, real estate, mining, utilities —
     and are assigned proper categories from scripts/taxonomy_category_map.py.

  B. Stale Macro_Sector after the Primary_Business_Type correction passes. Those passes
     rewrote Primary_Business_Type but left Macro_Sector and Business_Specialty untouched,
     so 3,818 manufacturing records still read as Services/Other with specialty
     "Venue / Activities" — a cement plant presented as an entertainment venue.

  C. Manufacturing sub_groups sitting under Recreation & Entertainment (vehicle, motorcycle
     and bicycle manufacture), which the Manufacturing pass missed because their `sector`
     is Logistics rather than Manufacturing.

Adds three Macro_Sector values to the original five: Construction, Agriculture, Extractive.

Idempotent and re-runnable: a second run reports zero changes.

Usage:  python scripts/apply_taxonomy_category_fixes.py [--dry-run]
"""
import csv, os, sys, shutil, tempfile
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from taxonomy_category_map import CATEGORY_MAP, nkey

csv.field_size_limit(10**9)

ROOT   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, "All_business_2016_DeepTaxonomy.csv")
AUDIT  = os.path.join(ROOT, "docs", "taxonomy_category_fixes.csv")

# Primary_Business_Type values that are really just the sector name leaking through.
LEAKED = {"Construction", "Service", "Trade", "Agriculture", "Mining and quarrying",
          "Logistics, transport and communication", "Tourism and Arts"}

# Business_Specialty values that are wrong for a manufacturing record.
BAD_MFG_SPECIALTY = {"Venue / Activities", "Unmapped", "Medical Facility",
                     "Consulting / Support", "Passenger & General Transport", "Unclassified"}

# D. Specialties left stale by the Primary_Business_Type correction passes: those passes
# rewrote the type but not the specialty, leaving combinations that contradict themselves
# (e.g. a General Consumer Goods record whose specialty still says Farming Supplies).
STALE_SPECIALTY = {
    ("General Consumer Goods", "Farming Supplies / Livestock"): "Standard Retail",
    ("General Consumer Goods", "Building Materials"):           "Standard Retail",
    ("Logistics & Transportation", "Consulting / Support"):     "Postal & Courier",
    ("Tourism and Arts", "Consulting / Support"):               "Tour Operations",
    ("Food & Beverage Manufacturing", "Heavy Manufacturing"):   "Food Processing",
    ("Consumer Goods Manufacturing", "Heavy Manufacturing"):    "Light Manufacturing",
}

def mfg_specialty(pbt):
    return "Food Processing" if pbt == "Food & Beverage Manufacturing" else "Heavy Manufacturing"

def main():
    dry = "--dry-run" in sys.argv
    if not os.path.exists(SOURCE):
        sys.exit(f"missing: {SOURCE}")

    tmpdir = os.environ.get("FIX_TMPDIR") or tempfile.gettempdir()
    staged = os.path.join(tmpdir, "taxonomy_category_fixes.tmp.csv")

    changes = Counter()
    unmapped_left = Counter()
    n = 0

    with open(SOURCE, newline="", encoding="utf-8") as fin, \
         open(staged, "w", newline="", encoding="utf-8") as fout:
        r = csv.DictReader(fin)
        header = r.fieldnames
        w = csv.DictWriter(fout, fieldnames=header)
        w.writeheader()

        for row in r:
            n += 1
            before = (row["Macro_Sector"], row["Primary_Business_Type"], row["Business_Specialty"])

            # --- A / C: assign real categories to unclassified + leaked records ---
            defective = (row["Business_Specialty"] in ("Unmapped", "Unclassified")
                         or row["Primary_Business_Type"] in LEAKED
                         or (row["Primary_Business_Type"] == "Recreation & Entertainment"
                             and nkey(row["sub_group"]).startswith("manufacture of")))
            if defective:
                hit = CATEGORY_MAP.get(nkey(row["sub_group"]))
                if hit:
                    row["Macro_Sector"], row["Primary_Business_Type"], row["Business_Specialty"] = hit
                elif row["Business_Specialty"] in ("Unmapped", "Unclassified"):
                    unmapped_left[row["sub_group"].strip()] += 1

            # --- B: make Macro_Sector and specialty follow the corrected type ---
            pbt = row["Primary_Business_Type"]
            if pbt.endswith("Manufacturing"):
                if row["Macro_Sector"] != "Manufacturing":
                    row["Macro_Sector"] = "Manufacturing"
                if row["Business_Specialty"] in BAD_MFG_SPECIALTY:
                    row["Business_Specialty"] = mfg_specialty(pbt)

            # --- D: repair specialties the correction passes left contradicting the type ---
            fixed = STALE_SPECIALTY.get((row["Primary_Business_Type"], row["Business_Specialty"]))
            if fixed:
                row["Business_Specialty"] = fixed

            after = (row["Macro_Sector"], row["Primary_Business_Type"], row["Business_Specialty"])
            if after != before:
                changes[(before, after)] += 1
            w.writerow(row)

    total = sum(changes.values())
    print(f"records read     : {n:,}")
    print(f"records changed  : {total:,}")
    print(f"records still unmapped: {sum(unmapped_left.values()):,}")
    print("\ntop transitions:")
    for (b, a), c in changes.most_common(14):
        print(f"  {c:>6,}  {b[1]} / {b[2]}  ->  {a[1]} / {a[2]}   [{b[0]} -> {a[0]}]")
    if unmapped_left:
        print("\nsub_groups with no mapping:")
        for k, v in unmapped_left.most_common(10):
            print(f"  {v:>6,}  {k[:66]}")

    if dry:
        print("\n--dry-run: source not modified.")
        return
    if total == 0:
        print("\nNothing to change; source left untouched.")
        return

    shutil.copyfile(staged, SOURCE)

    os.makedirs(os.path.dirname(AUDIT), exist_ok=True)
    with open(AUDIT, "w", newline="", encoding="utf-8") as f:
        wa = csv.writer(f)
        wa.writerow(["rows", "old_macro_sector", "old_primary_business_type", "old_business_specialty",
                     "new_macro_sector", "new_primary_business_type", "new_business_specialty"])
        for (b, a), c in changes.most_common():
            wa.writerow([c, b[0], b[1], b[2], a[0], a[1], a[2]])
    print(f"\nSource updated. Audit written to {os.path.relpath(AUDIT, ROOT)}")

if __name__ == "__main__":
    main()
