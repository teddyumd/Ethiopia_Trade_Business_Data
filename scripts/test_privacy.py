"""
Assert that the published aggregate file leaks nothing personal.

The register carries owner names, manager names and telephone numbers. The site
publishes `business_landscape.json` to the open web, so this is the boundary that
matters: anything in that file is public. The rule is enforced here rather than
trusted, because the preparation script is edited often and a new aggregate could
carry a record-level field through without anyone noticing.

Run:  python scripts/test_privacy.py
Exit code 0 on pass, 1 on failure; prints what it checked either way.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLISHED = ROOT / "profile-visualization" / "data" / "business_landscape.json"

# Columns in the source register that must never reach the published file.
PERSONAL_FIELDS = [
    "busi_name", "mgr_fname", "mgr_mname", "mgr_lname",
    "mgr_phone", "busi_phone", "house_num",
]

# Ethiopian subscriber numbers run 9-10 digits, usually starting 09 or 9.
PHONE = re.compile(r"\b0?9\d{8}\b")

# Keys whose values are counts or money, where a long digit run is legitimate.
NUMERIC_KEYS = {
    "count", "total", "totalCapital", "median", "min", "max",
    "p25", "p50", "p75", "p90", "p99", "records", "recordsWithCapital",
    "soleProprietorShare", "totalBusinesses",
}

failures = []
checks = []


def walk(node, path="$"):
    """Yield every (path, key, value) in the document."""
    if isinstance(node, dict):
        for k, v in node.items():
            yield path, k, v
            yield from walk(v, f"{path}.{k}")
    elif isinstance(node, list):
        for i, v in enumerate(node):
            yield from walk(v, f"{path}[{i}]")


def main():
    if not PUBLISHED.exists():
        print(f"FAIL  published file not found: {PUBLISHED}")
        return 1

    raw = PUBLISHED.read_text(encoding="utf-8")
    doc = json.loads(raw)

    # 1. No personal column name appears anywhere - as a key or inside a value.
    hits = [f for f in PERSONAL_FIELDS if f in raw]
    checks.append(("no personal field names anywhere in the file", not hits))
    if hits:
        failures.append(f"personal field name(s) present: {hits}")

    # 2. No value looks like a telephone number.
    phone_hits = []
    for parent, key, value in walk(doc):
        if isinstance(value, str) and PHONE.search(value):
            phone_hits.append(f"{parent}.{key} = {value[:40]!r}")
    checks.append(("no telephone-shaped values", not phone_hits))
    if phone_hits:
        failures.append(f"telephone-shaped value(s): {phone_hits[:5]}")

    # 3. Every leaf is either a label, a number, or a container - never free text
    #    long enough to be a business name someone filed.
    long_text = []
    for parent, key, value in walk(doc):
        if isinstance(value, str) and len(value) > 120:
            long_text.append(f"{parent}.{key} ({len(value)} chars)")
    checks.append(("no free-text values over 120 characters", not long_text))
    if long_text:
        failures.append(f"suspiciously long text: {long_text[:5]}")

    # 4. Small-cell disclosure control.
    #
    #    The risk is not that a small group exists - "one registered business in
    #    this woreda" is a count of a public register and says nothing about that
    #    business. The risk is an ATTRIBUTE published for a group small enough to
    #    identify: a median computed over one business IS that business's
    #    registered capital. So the rule is about cells that carry statistics,
    #    not about cells that carry only a count.
    MIN_CELL = 5
    STAT_KEYS = {"median", "p25", "p75", "p90", "p99", "totalCapital", "medianCapital"}

    exposed = []
    for parent, key, value in walk(doc):
        if not isinstance(value, dict):
            continue
        n = value.get("count")
        if not isinstance(n, int) or n >= MIN_CELL:
            continue
        stats = sorted(STAT_KEYS & {k for k, v in value.items() if v not in (None, 0)})
        if stats:
            exposed.append(f"{parent}.{key} (n={n}, publishes {', '.join(stats)})")

    checks.append(
        (f"no capital statistics published for groups under {MIN_CELL}", not exposed)
    )
    if exposed:
        failures.append(
            f"{len(exposed)} group(s) below the disclosure threshold still publish "
            f"capital statistics: {exposed[:5]}"
        )

    # Informational: small counts with no attribute attached are allowed, but
    # worth knowing about if the threshold is ever revisited.
    bare_small = sum(
        1
        for _, _, v in walk(doc)
        if isinstance(v, dict)
        and isinstance(v.get("count"), int)
        and v["count"] < MIN_CELL
        and not (STAT_KEYS & set(v))
    )

    # 5. The declared privacy note is still present, so the claim the site makes
    #    to its readers stays true.
    note = doc.get("metadata", {}).get("privacyNote", "")
    checks.append(("metadata still carries the privacy note", bool(note)))
    if not note:
        failures.append("metadata.privacyNote is missing")

    width = max(len(name) for name, _ in checks)
    for name, ok in checks:
        print(f"  [{'PASS' if ok else 'FAIL'}] {name.ljust(width)}")

    print(f"\nchecked {PUBLISHED.relative_to(ROOT)} ({len(raw):,} bytes)")
    print(f"note: {bare_small} group(s) hold fewer than {MIN_CELL} businesses but "
          f"publish only a count, which discloses no attribute of any of them.")
    if failures:
        print("\nFAILURES:")
        for f in failures:
            print(f"  - {f}")
        return 1
    print("No personal data reaches the published file.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
