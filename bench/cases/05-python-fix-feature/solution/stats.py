"""Column statistics for a CSV file.

Usage: python3 stats.py FILE --column NAME [--json]
"""
import argparse
import csv
import json
import sys


def read_column(path, column):
    with open(path, newline="") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames is None or column not in reader.fieldnames:
            raise KeyError(column)
        values = []
        for row in reader:
            cell = (row.get(column) or "").strip()
            try:
                values.append(float(cell))
            except ValueError:
                continue  # empty or not a number: skipped
        return values


def summarize(values):
    ordered = sorted(values)
    n = len(ordered)
    mid = n // 2
    return {
        "count": n,
        "mean": sum(ordered) / n,
        "median": ordered[mid] if n % 2 else (ordered[mid - 1] + ordered[mid]) / 2,
        "min": ordered[0],
        "max": ordered[-1],
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description="Column statistics for a CSV file")
    parser.add_argument("file")
    parser.add_argument("--column", required=True)
    parser.add_argument("--json", action="store_true", help="print one JSON object")
    args = parser.parse_args(argv)
    try:
        values = read_column(args.file, args.column)
    except FileNotFoundError:
        print(f"error: no such file: {args.file}", file=sys.stderr)
        return 1
    except KeyError:
        print(f"error: no column named {args.column!r}", file=sys.stderr)
        return 1
    if not values:
        print("error: no numeric values", file=sys.stderr)
        return 1
    s = summarize(values)
    if args.json:
        print(json.dumps(s))
        return 0
    print(f"count: {s['count']}")
    print(f"mean: {s['mean']:.2f}")
    print(f"median: {s['median']:.2f}")
    print(f"min: {s['min']:.2f}")
    print(f"max: {s['max']:.2f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
