import csv
import shutil
from pathlib import Path

from prepare_profile_viz_data import SOURCE, corrected_primary_type


import os as _os, tempfile as _tempfile

def _staged_path(source):
    d = _os.environ.get("FIX_TMPDIR") or _tempfile.gettempdir()
    return Path(d) / (source.name + ".tmp.csv")

ROOT = Path(__file__).resolve().parents[1]
AUDIT_FILE = ROOT / "docs" / "manufacturing_primary_type_corrections.csv"


def main():
    temp_file = _staged_path(SOURCE)
    changes = []

    with SOURCE.open("r", encoding="utf-8-sig", newline="") as source_handle:
        reader = csv.DictReader(source_handle)
        fieldnames = reader.fieldnames or []

        if "Primary_Business_Type" not in fieldnames:
            raise ValueError("Primary_Business_Type column was not found.")

        with temp_file.open("w", encoding="utf-8-sig", newline="") as temp_handle:
            writer = csv.DictWriter(temp_handle, fieldnames=fieldnames)
            writer.writeheader()

            for row_number, row in enumerate(reader, start=2):
                original = (row.get("Primary_Business_Type") or "").strip()
                corrected = corrected_primary_type(row)

                if corrected != original:
                    changes.append(
                        {
                            "source_row": row_number,
                            "sector": row.get("sector", ""),
                            "busi_desc": row.get("busi_desc", ""),
                            "sub_group": row.get("sub_group", ""),
                            "old_primary_business_type": original,
                            "new_primary_business_type": corrected,
                        }
                    )
                    row["Primary_Business_Type"] = corrected

                writer.writerow(row)

    shutil.copyfile(str(temp_file), str(SOURCE))

    AUDIT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with AUDIT_FILE.open("w", encoding="utf-8", newline="") as audit_handle:
        fieldnames = [
            "source_row",
            "sector",
            "busi_desc",
            "sub_group",
            "old_primary_business_type",
            "new_primary_business_type",
        ]
        writer = csv.DictWriter(audit_handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(changes)

    print(f"Updated {SOURCE}")
    print(f"Wrote {AUDIT_FILE}")
    print(f"Changed {len(changes):,} rows")


if __name__ == "__main__":
    main()
