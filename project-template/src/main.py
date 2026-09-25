"""Example pipeline — replace with the project's own.

Writes a portfolio-output/1 file from a synthetic monthly series, so the
whole pipeline (validate → publish → portfolio refresh) can be tested before
the real analysis exists. Standard library only.
"""

import argparse
import datetime as dt
import json
import math
from pathlib import Path


def month_starts(count: int, end: dt.date) -> list[dt.date]:
    months = []
    year, month = end.year, end.month
    for _ in range(count):
        months.append(dt.date(year, month, 1))
        month -= 1
        if month == 0:
            year, month = year - 1, 12
    return list(reversed(months))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="site/latest.json")
    args = parser.parse_args()

    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    months = month_starts(36, now.date())
    values = [round(2.0 + 1.2 * math.sin(i / 5) + 0.3 * math.cos(i / 2), 2) for i in range(len(months))]
    bands = [(round(v - 0.4, 2), round(v + 0.4, 2)) for v in values]

    output = {
        "schema": "portfolio-output/1",
        "updatedAt": now.isoformat().replace("+00:00", "Z"),
        "status": "ok",
        "headline": [
            {
                "id": "latest",
                "label": "Example indicator",
                "value": values[-1],
                "unit": "%",
                "change": round(values[-1] - values[-2], 2),
                "asOf": months[-1].isoformat(),
            }
        ],
        "series": [
            {
                "id": "example",
                "label": "Example indicator",
                "unit": "%",
                "points": [[m.isoformat(), v, lo, hi] for m, v, (lo, hi) in zip(months, values, bands)],
            }
        ],
        "notes": "Template output — replace src/main.py with the project's pipeline.",
    }

    path = Path(args.out)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {path}")


if __name__ == "__main__":
    main()
