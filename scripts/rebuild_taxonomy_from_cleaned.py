"""
Rebuild All_business_2016_DeepTaxonomy.csv from `All business 2016 cleaned.xlsx`.

Why this source, and not the raw CSV
------------------------------------
`All business 2016 cleaned.xlsx` holds exactly 345,369 records — the record count the
project documentation reports for the enriched taxonomy file. Its 15 columns are an exact
prefix of the taxonomy file's 18, same names, same order. The raw export
(`All Business 2016.csv`) holds ~493,700 rows; rebuilding from it would reintroduce roughly
140,000 records that the cleaning step deliberately removed. The cleaned workbook is
therefore the true parent of the taxonomy file.

The enrichment added exactly three columns: Macro_Sector, Primary_Business_Type,
Business_Specialty. Those are ~98% deterministic on `sub_group`, so they are recoverable as
a lookup learned from whatever classified rows survive.

Records whose sub_group was never seen in the surviving classified set are emitted with
"Unclassified" in the three derived columns, so gaps are explicit rather than silently wrong.

Also applies the category spelling corrections (see fix_source_category_spellings.py) so the
rebuilt file does not reintroduce `Toursim and Arts` etc.

Nothing is overwritten. Output goes to a new file.

Usage:  python scripts/rebuild_taxonomy_from_cleaned.py
"""
import csv, os, sys, re, unicodedata, tempfile, shutil
from collections import Counter, defaultdict

csv.field_size_limit(10**9)

CLEANED = "All business 2016 cleaned.xlsx"
TAX     = "All_business_2016_DeepTaxonomy.csv"
OUT     = "All_business_2016_DeepTaxonomy_rebuilt.csv"
AUDIT   = "docs/taxonomy_rebuild_audit.csv"

DERIVED = ["Macro_Sector", "Primary_Business_Type", "Business_Specialty"]
UNCLASSIFIED = ("Unclassified", "Unclassified", "Unclassified")

SPELLING = {
    "legal_status_name": {
        "Paretnership": "Partnership", "Ordinary Paretnership": "Ordinary Partnership",
        "Limited Liabilty Paretnership": "Limited Liability Partnership",
        "share Company": "Share Company", "Public EnterPrise": "Public Enterprise",
        "Non Public EnterPrise": "Non Public Enterprise",
    },
    "sector": {"Toursim and Arts": "Tourism and Arts"},
    "Primary_Business_Type": {"Toursim and Arts": "Tourism and Arts"},
}

# Apostrophes appear inconsistently across these files (real U+2019, ASCII quote, and a
# stray 0x19 control byte in some exports). All must be deleted, not spaced, or the
# sub_group lookup silently misses thousands of rows.
_DROP = re.compile(r"[\x00-\x1f'’`´ʼ]")

def norm(s):
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode()
    s = _DROP.sub("", s).lower()
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()

def cell(v):
    """Excel -> text. Trailing whitespace is stripped because the original enrichment
    trimmed it (e.g. 'South West Ethiopia ' is stored padded in the workbook but appears
    trimmed in the taxonomy file and in the published aggregates)."""
    if v is None: return ""
    if isinstance(v, float) and v.is_integer(): return str(int(v)).strip()
    return str(v).strip()

def main():
    for p in (CLEANED, TAX):
        if not os.path.exists(p): sys.exit(f"missing: {p}")
    try:
        import openpyxl
    except ImportError:
        sys.exit("openpyxl required: pip install openpyxl")

    # ---- learn sub_group -> derived-columns rules from surviving classified rows ----
    with open(TAX, newline="", encoding="utf-8") as f:
        r = csv.DictReader(f)
        header = r.fieldnames
        rules = defaultdict(Counter)
        learned_from = 0
        for row in r:
            if not row.get("sub_group"): continue
            vals = tuple(row.get(c) or "" for c in DERIVED)
            if not any(vals): continue
            rules[norm(row["sub_group"])][vals] += 1
            learned_from += 1
    rule = {sg: c.most_common(1)[0][0] for sg, c in rules.items()}
    ambiguous = sum(1 for c in rules.values() if len(c) > 1)

    # ---- stream the cleaned workbook, append derived columns -----------------------
    wb = openpyxl.load_workbook(CLEANED, read_only=True, data_only=True)
    ws = wb[wb.sheetnames[0]]
    it = ws.iter_rows(values_only=True)
    xh = [cell(c) for c in next(it)]
    if xh != header[:len(xh)]:
        wb.close()
        sys.exit(f"column mismatch.\n cleaned: {xh}\n taxonomy prefix: {header[:len(xh)]}")

    tmpdir = os.environ.get("FIX_TMPDIR") or tempfile.gettempdir()
    staged = os.path.join(tmpdir, "taxonomy_from_cleaned.tmp.csv")
    n = classified = unclassified = spellfixed = 0
    unseen = Counter()

    with open(staged, "w", newline="", encoding="utf-8") as fout:
        w = csv.writer(fout)
        w.writerow(header)
        for xrow in it:
            if xrow is None: continue
            vals = [cell(c) for c in xrow]
            if not any(vals): continue
            vals = (vals + [""] * len(xh))[:len(xh)]
            rec = dict(zip(xh, vals))
            n += 1
            sg = norm(rec.get("sub_group"))
            got = rule.get(sg)
            if got is None:
                got = UNCLASSIFIED
                unclassified += 1
                unseen[(rec.get("sub_group") or "").strip()] += 1
            else:
                classified += 1
            for c, v in zip(DERIVED, got):
                rec[c] = v
            for col, mapping in SPELLING.items():
                if rec.get(col) in mapping:
                    rec[col] = mapping[rec[col]]
                    spellfixed += 1
            w.writerow([rec.get(c, "") for c in header])
    wb.close()
    shutil.copyfile(staged, OUT)

    os.makedirs("docs", exist_ok=True)
    with open(AUDIT, "w", newline="", encoding="utf-8") as f:
        wa = csv.writer(f)
        wa.writerow(["metric", "value"])
        for k, v in [("source", CLEANED), ("records_written", n),
                     ("classified_by_rule", classified), ("unclassified", unclassified),
                     ("spelling_corrections_applied", spellfixed),
                     ("rules_learned", len(rule)), ("rules_ambiguous", ambiguous),
                     ("rules_learned_from_rows", learned_from)]:
            wa.writerow([k, v])
        wa.writerow([])
        wa.writerow(["unseen_sub_group", "rows"])
        for k, v in unseen.most_common():
            wa.writerow([k, v])

    print(f"source                  : {CLEANED}")
    print(f"records written         : {n:,}")
    print(f"   classified by rule   : {classified:,}  ({100*classified/n:.2f}%)")
    print(f"   Unclassified         : {unclassified:,}  ({100*unclassified/n:.2f}%)")
    print(f"spelling fixes applied  : {spellfixed:,}")
    print(f"rules learned           : {len(rule):,} from {learned_from:,} rows ({ambiguous} ambiguous)")
    print(f"\nwrote {OUT}")
    print(f"audit {AUDIT}")

if __name__ == "__main__":
    main()
