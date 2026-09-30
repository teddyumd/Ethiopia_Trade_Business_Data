"""
Rebuild All_business_2016_DeepTaxonomy.csv by importing the records that are present in
the raw export ("All Business 2016.csv") but absent from the truncated taxonomy file.

Method
------
The taxonomy columns are ~98% deterministic on `sub_group`: within a given sub_group,
essentially every record carries the same sector / Macro_Sector / Primary_Business_Type /
Business_Specialty. That makes the classification recoverable as a lookup rather than a
model. This script:

  1. Learns a sub_group -> (4 taxonomy columns) rule from the surviving classified rows.
  2. Joins raw rows against the taxonomy file to find which raw rows are missing.
  3. Emits every surviving taxonomy row unchanged, then appends the missing raw rows
     with taxonomy columns filled from the learned rule.

Rows whose sub_group was never seen in the classified set are still emitted, marked
"Unclassified" so they are explicit rather than silently wrong.

Encoding note: the raw export is cp1252, not UTF-8. Reading it as UTF-8 corrupts accented
characters and silently breaks the join.

Nothing is overwritten. Output goes to a new file.

Usage:  python scripts/rebuild_taxonomy_from_raw.py
"""
import csv, os, sys, hashlib, unicodedata, re, tempfile
from collections import Counter, defaultdict

csv.field_size_limit(10**9)

RAW   = "All Business 2016.csv"
TAX   = "All_business_2016_DeepTaxonomy.csv"
OUT   = "All_business_2016_DeepTaxonomy_rebuilt.csv"
AUDIT = "docs/taxonomy_rebuild_audit.csv"

TAXCOLS = ["sector", "Macro_Sector", "Primary_Business_Type", "Business_Specialty"]
UNCLASSIFIED = ("Unclassified", "Unclassified", "Unclassified", "Unclassified")

# raw column -> taxonomy column
COLMAP = {
    "LegalStatusNameEng": "legal_status_name", "BusinessName": "busi_name",
    "Capital": "capital", "ManagerFName": "mgr_fname", "ManagerMName": "mgr_mname",
    "ManagerLName": "mgr_lname", "MangerPhone": "mgr_phone", "SubGroupEN": "sub_group",
    "HousNum": "house_num", "BussinessTelephone": "busi_phone",
    "BussinessdescriptionRegion": "region", "BussinessDescriptionZones": "zone",
    "BussinessDescriptionWoredas": "woreda", "EnglishDescription": "busi_desc",
}

def reader(path, enc):
    f = open(path, encoding=enc, errors="replace", newline="")
    return csv.reader(l.replace("\x00", "") for l in f)

# Apostrophes appear three ways across these files: a real U+2019 in the taxonomy file,
# a plain ASCII quote, and a stray 0x19 control byte in the raw export where the
# apostrophe was mangled. All three must be DELETED (not turned into a space), or
# "Men’s" and "Men\x19s" normalize to different tokens and the join silently misses
# ~12,000 rows.
_DROP = re.compile(r"[\x00-\x1f'’`´ʼ]")

def norm(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
    s = _DROP.sub("", s).lower()
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()

def nphone(s):
    return (s or "").strip().lstrip("0")

def ncap(s):
    s = (s or "").strip().replace(",", "")
    try:
        return f"{float(s):.2f}"
    except ValueError:
        return s.lower()

def key(name, cap, phone, region, woreda, subgroup):
    return hashlib.blake2b(
        "|".join((norm(name), ncap(cap), nphone(phone),
                  norm(region), norm(woreda), norm(subgroup))).encode(),
        digest_size=12).digest()

def main():
    for p in (RAW, TAX):
        if not os.path.exists(p):
            sys.exit(f"missing: {p}")

    # ---- pass 1: learn rules + index surviving rows -------------------------
    t = reader(TAX, "utf-8"); th = next(t)
    ti = {c: i for i, c in enumerate(th)}
    rules = defaultdict(Counter)
    seen = set()
    kept = 0
    tmpdir = os.environ.get("FIX_TMPDIR") or tempfile.gettempdir()
    staged = os.path.join(tmpdir, "taxonomy_rebuilt.tmp.csv")

    with open(staged, "w", newline="", encoding="utf-8") as fout:
        w = csv.writer(fout)
        w.writerow(th)
        for row in t:
            if len(row) < len(th):
                continue
            kept += 1
            w.writerow(row)
            seen.add(key(row[ti["busi_name"]], row[ti["capital"]], row[ti["mgr_phone"]],
                         row[ti["region"]], row[ti["woreda"]], row[ti["sub_group"]]))
            rules[norm(row[ti["sub_group"]])][tuple(row[ti[c]] for c in TAXCOLS)] += 1

        rule = {sg: c.most_common(1)[0][0] for sg, c in rules.items()}
        ambiguous = sum(1 for c in rules.values() if len(c) > 1)

        # ---- pass 2: append missing raw rows --------------------------------
        r = reader(RAW, "cp1252"); rh = next(r)
        rh[0] = rh[0].lstrip("﻿\xff")
        ri = {c: i for i, c in enumerate(rh)}
        missing = [c for c in COLMAP if c not in ri]
        if missing:
            sys.exit(f"raw file missing expected columns: {missing}")

        added = 0
        unclassified = 0
        unseen = Counter()
        for row in r:
            if len(row) < len(rh):
                continue
            k = key(row[ri["BusinessName"]], row[ri["Capital"]], row[ri["MangerPhone"]],
                    row[ri["BussinessdescriptionRegion"]], row[ri["BussinessDescriptionWoredas"]],
                    row[ri["SubGroupEN"]])
            if k in seen:
                continue
            seen.add(k)
            sg = norm(row[ri["SubGroupEN"]])
            tax = rule.get(sg)
            if tax is None:
                tax = UNCLASSIFIED
                unclassified += 1
                unseen[row[ri["SubGroupEN"]].strip()] += 1
            out = {COLMAP[c]: row[ri[c]] for c in COLMAP}
            for c, v in zip(TAXCOLS, tax):
                out[c] = v
            w.writerow([out.get(c, "") for c in th])
            added += 1

    import shutil
    shutil.copyfile(staged, OUT)

    os.makedirs("docs", exist_ok=True)
    with open(AUDIT, "w", newline="", encoding="utf-8") as f:
        wa = csv.writer(f)
        wa.writerow(["metric", "value"])
        for k_, v_ in [("surviving_rows_kept", kept), ("rows_imported_from_raw", added),
                       ("imported_classified", added - unclassified),
                       ("imported_unclassified", unclassified),
                       ("total_rows_out", kept + added),
                       ("subgroup_rules_learned", len(rule)),
                       ("subgroup_rules_ambiguous", ambiguous)]:
            wa.writerow([k_, v_])
        wa.writerow([])
        wa.writerow(["unseen_sub_group", "rows"])
        for k_, v_ in unseen.most_common():
            wa.writerow([k_, v_])

    print(f"surviving rows kept      : {kept:,}")
    print(f"rows imported from raw   : {added:,}")
    print(f"   classified by rule    : {added - unclassified:,}")
    print(f"   left Unclassified     : {unclassified:,}")
    print(f"total rows written       : {kept + added:,}")
    print(f"sub_group rules learned  : {len(rule):,} ({ambiguous} ambiguous, majority used)")
    print(f"\nwrote {OUT}")
    print(f"audit {AUDIT}")

if __name__ == "__main__":
    main()
