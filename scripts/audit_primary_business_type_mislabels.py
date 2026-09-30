import csv
from collections import Counter, defaultdict
from pathlib import Path

from prepare_profile_viz_data import SOURCE, clean, corrected_primary_type


ROOT = Path(__file__).resolve().parents[1]
AUDIT_CSV = ROOT / "docs" / "primary_business_type_mislabel_audit.csv"
SUMMARY_MD = ROOT / "docs" / "primary_business_type_mislabel_audit.md"


def text_for(row):
    return f"{row.get('busi_desc') or ''} {row.get('sub_group') or ''}".lower()


def suggested_primary_type(row):
    sector = clean(row.get("sector"))
    current = clean(row.get("Primary_Business_Type"))
    text = text_for(row)

    manufacturing = corrected_primary_type(row)
    if sector == "Manufacturing":
        return manufacturing, "high", "Manufacturing sector and description support a manufacturing-specific label."

    if "department stores retail trade" in text:
        return "General Consumer Goods", "high", "Department-store retail is broader than food and grocery."

    if "special houses retail trade" in text or "special houses wholesale trade" in text:
        return "General Consumer Goods", "medium", "Special-house retail/wholesale does not align with agriculture retail."

    if sector == "Agriculture":
        if any(term in text for term in ["growing of crop", "farming of animals", "hunting", "agricultural support"]):
            return "Agriculture", "high", "Agriculture sector and activity description point to agricultural production."

    if sector == "Logistics, transport and communication":
        if any(
            term in text
            for term in [
                "transport services",
                "transportation maintenance",
                "storage",
                "warehousing",
                "auxiliary transport",
                "parking",
                "vehicle parking",
            ]
        ):
            return "Logistics & Transportation", "high", "Transport, storage, warehousing, or parking activity belongs in logistics."
        if any(term in text for term in ["communication", "postal", "courier"]):
            return "Logistics & Transportation", "high", "Communication, postal, or courier activity belongs in logistics."

    if sector == "Tourism and Arts":
        if "tour operators" in text or "travel agency" in text or "tourism" in text:
            return "Tourism and Arts", "high", "Tour operator or travel-agency activity belongs in tourism and arts."
        if any(term in text for term in ["drama", "music", "theater", "film", "painting", "sculpture"]):
            return "Recreation & Entertainment", "high", "Arts and entertainment description matches recreation and entertainment."

    if sector == "Service":
        if "agricultural support" in text:
            return "Professional & General Services", "medium", "Agricultural support appears to be a service activity, not retail."
        if "department stores retail trade" in text:
            return "General Consumer Goods", "high", "Department-store retail is broader than food and grocery."

    return current, "", ""


def main():
    grouped = Counter()
    examples = defaultdict(list)

    with SOURCE.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row_number, row in enumerate(reader, start=2):
            current = clean(row.get("Primary_Business_Type"))
            suggested, confidence, reason = suggested_primary_type(row)
            if suggested == current:
                continue

            key = (
                clean(row.get("sector")),
                clean(row.get("busi_desc")),
                current,
                suggested,
                confidence,
                reason,
            )
            grouped[key] += 1
            if len(examples[key]) < 3:
                examples[key].append(
                    {
                        "source_row": row_number,
                        "sub_group": row.get("sub_group", ""),
                    }
                )

    rows = []
    for (sector, busi_desc, current, suggested, confidence, reason), count in grouped.most_common():
        sample = examples[(sector, busi_desc, current, suggested, confidence, reason)][0]
        rows.append(
            {
                "count": count,
                "sector": sector,
                "busi_desc": busi_desc,
                "current_primary_business_type": current,
                "suggested_primary_business_type": suggested,
                "confidence": confidence,
                "reason": reason,
                "sample_source_row": sample["source_row"],
                "sample_sub_group": sample["sub_group"],
            }
        )

    AUDIT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with AUDIT_CSV.open("w", encoding="utf-8", newline="") as handle:
        fieldnames = [
            "count",
            "sector",
            "busi_desc",
            "current_primary_business_type",
            "suggested_primary_business_type",
            "confidence",
            "reason",
            "sample_source_row",
            "sample_sub_group",
        ]
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    total = sum(row["count"] for row in rows)
    with SUMMARY_MD.open("w", encoding="utf-8") as handle:
        handle.write("# Primary Business Type Mislabel Audit\n\n")
        handle.write(
            "This is a read-only audit of likely `Primary_Business_Type` mislabels. "
            "It compares the current category to `sector`, `busi_desc`, and `sub_group`, "
            "then suggests a replacement only for high-confidence text matches.\n\n"
        )
        handle.write(f"Potentially mislabeled records found: **{total:,}**\n\n")
        handle.write("## Top Findings\n\n")
        handle.write("| Count | Sector | busi_desc | Current | Suggested | Confidence |\n")
        handle.write("|---:|---|---|---|---|---|\n")
        for row in rows[:20]:
            handle.write(
                f"| {row['count']:,} | {row['sector']} | {row['busi_desc']} | "
                f"{row['current_primary_business_type']} | {row['suggested_primary_business_type']} | "
                f"{row['confidence']} |\n"
            )
        handle.write("\n")
        handle.write(
            "The audit intentionally avoids changing the source CSV. Review the CSV audit "
            "before applying these suggestions to the main data file.\n"
        )

    print(f"Wrote {AUDIT_CSV}")
    print(f"Wrote {SUMMARY_MD}")
    print(f"Potentially mislabeled records: {total:,}")


if __name__ == "__main__":
    main()
