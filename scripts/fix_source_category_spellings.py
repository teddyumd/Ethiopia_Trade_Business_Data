"""
Correct misspelled CATEGORY labels in All_business_2016_DeepTaxonomy.csv, in place.

Scope is deliberately narrow: only the controlled-vocabulary category columns are
touched. Free-text registry fields (busi_desc, sub_group) are left exactly as filed,
because they are the registrant's own words, not a category system.

The script is idempotent and re-runnable: running it on an already-corrected file
changes nothing and reports zero edits. Safe to re-run after the full source CSV is
restored.

Usage:
    python scripts/fix_source_category_spellings.py [--dry-run]
"""
import csv, os, sys, shutil, tempfile
from collections import Counter

csv.field_size_limit(10**9)

SRC = "All_business_2016_DeepTaxonomy.csv"
AUDIT = "docs/category_spelling_corrections.csv"

# column -> {stored value: corrected value}
FIXES = {
    "legal_status_name": {
        "Paretnership":                   "Partnership",
        "Ordinary Paretnership":          "Ordinary Partnership",
        "Limited Liabilty Paretnership":  "Limited Liability Partnership",
        "share Company":                  "Share Company",
        "Public EnterPrise":              "Public Enterprise",
        "Non Public EnterPrise":          "Non Public Enterprise",
    },
    "sector": {
        "Toursim and Arts": "Tourism and Arts",
    },
    "Primary_Business_Type": {
        "Toursim and Arts": "Tourism and Arts",
    },
}

def main():
    dry = "--dry-run" in sys.argv
    if not os.path.exists(SRC):
        sys.exit(f"Source not found: {SRC}")

    counts = Counter()
    rows_in = 0

    # Staging file lives outside the mounted folder: this workspace cannot delete
    # files inside it, so the temp file must not be created there.
    tmpdir = os.environ.get("FIX_TMPDIR") or tempfile.gettempdir()
    tmp = os.path.join(tmpdir, "deeptaxonomy_fix.tmp.csv")

    with open(SRC, newline="", encoding="utf-8", errors="replace") as fin, \
         open(tmp, "w", newline="", encoding="utf-8") as fout:
        r = csv.DictReader(fin)
        fieldnames = r.fieldnames
        w = csv.DictWriter(fout, fieldnames=fieldnames)
        w.writeheader()
        for row in r:
            rows_in += 1
            for col, mapping in FIXES.items():
                v = row.get(col)
                if v in mapping:
                    row[col] = mapping[v]
                    counts[(col, v, mapping[v])] += 1
            w.writerow(row)

    total = sum(counts.values())
    print(f"records read      : {rows_in:,}")
    print(f"values corrected  : {total:,}")
    for (col, old, new), n in sorted(counts.items(), key=lambda x: -x[1]):
        print(f"  {n:>8,}  {col}: {old!r} -> {new!r}")

    if dry:
        print("\n--dry-run: source not modified.")
        return

    if total == 0:
        print("\nNothing to correct; source left untouched.")
        return

    # Overwrite in place rather than rename: avoids needing delete permission,
    # and keeps the original inode/path the visualization scripts expect.
    shutil.copyfile(tmp, SRC)

    os.makedirs("docs", exist_ok=True)
    with open(AUDIT, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["column", "old_value", "new_value", "rows_changed"])
        for (col, old, new), n in sorted(counts.items(), key=lambda x: -x[1]):
            w.writerow([col, old, new, n])
    print(f"\nSource updated in place. Audit written to {AUDIT}")

if __name__ == "__main__":
    main()
