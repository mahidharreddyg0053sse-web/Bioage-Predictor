"""
Evaluates Locust CSV statistics against SLA performance thresholds
and writes Markdown + JSON summary reports.
"""

import argparse
import csv
import json
import os
import sys


def parse_args():
    parser = argparse.ArgumentParser(description="Evaluate Locust performance thresholds")
    parser.add_argument("--csv-prefix", required=True)
    parser.add_argument("--profile", required=True)
    parser.add_argument("--users", required=True, type=int)
    parser.add_argument("--max-avg-ms", required=True, type=float)
    parser.add_argument("--max-p95-ms", required=True, type=float)
    parser.add_argument("--max-error-rate", required=True, type=float)
    parser.add_argument("--min-rps", required=True, type=float)
    parser.add_argument("--summary-md", required=True)
    parser.add_argument("--summary-json", required=True)
    return parser.parse_args()


def main():
    args = parse_args()
    stats_csv = f"{args.csv_prefix}_stats.csv"

    if not os.path.exists(stats_csv):
        print(f"ERROR: Locust stats file not found: {stats_csv}")
        sys.exit(1)

    aggregated = None
    with open(stats_csv, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("Name") == "Aggregated":
                aggregated = row
                break

    if not aggregated:
        print("ERROR: Aggregated row not found in Locust stats CSV.")
        sys.exit(1)

    total_requests = int(float(aggregated.get("Request Count", 0) or 0))
    failure_count = int(float(aggregated.get("Failure Count", 0) or 0))
    avg_ms = float(aggregated.get("Average Response Time", 0) or 0)
    p95_ms = float(aggregated.get("95%", 0) or 0)
    rps = float(aggregated.get("Requests/s", 0) or 0)
    error_rate = (failure_count / total_requests * 100.0) if total_requests > 0 else 100.0

    checks = {
        "avg_latency": avg_ms <= args.max_avg_ms,
        "p95_latency": p95_ms <= args.max_p95_ms,
        "error_rate": error_rate <= args.max_error_rate,
        "throughput_rps": rps >= args.min_rps,
        "non_zero_requests": total_requests > 0,
    }
    passed = all(checks.values())

    summary_data = {
        "profile": args.profile,
        "users": args.users,
        "total_requests": total_requests,
        "failure_count": failure_count,
        "error_rate_pct": round(error_rate, 2),
        "avg_response_ms": round(avg_ms, 2),
        "p95_response_ms": round(p95_ms, 2),
        "requests_per_second": round(rps, 2),
        "thresholds": {
            "max_avg_ms": args.max_avg_ms,
            "max_p95_ms": args.max_p95_ms,
            "max_error_rate_pct": args.max_error_rate,
            "min_rps": args.min_rps,
        },
        "checks": checks,
        "passed": passed,
    }

    os.makedirs(os.path.dirname(args.summary_json), exist_ok=True)
    with open(args.summary_json, "w", encoding="utf-8") as jf:
        json.dump(summary_data, jf, indent=2)

    status_badge = "PASS" if passed else "FAIL"
    md = f"""## {args.profile.capitalize()} Traffic Profile ({args.users} Concurrent Users) — **{status_badge}**

| Metric | Measured | Threshold | Status |
| --- | ---: | ---: | :---: |
| Total Requests | {total_requests} | > 0 | {'PASS' if checks['non_zero_requests'] else 'FAIL'} |
| Error Rate | {error_rate:.2f}% ({failure_count} fails) | <= {args.max_error_rate:.2f}% | {'PASS' if checks['error_rate'] else 'FAIL'} |
| Average Latency | {avg_ms:.2f} ms | <= {args.max_avg_ms:.0f} ms | {'PASS' if checks['avg_latency'] else 'FAIL'} |
| P95 Latency | {p95_ms:.2f} ms | <= {args.max_p95_ms:.0f} ms | {'PASS' if checks['p95_latency'] else 'FAIL'} |
| Throughput | {rps:.2f} req/s | >= {args.min_rps:.1f} req/s | {'PASS' if checks['throughput_rps'] else 'FAIL'} |
"""
    with open(args.summary_md, "w", encoding="utf-8") as mf:
        mf.write(md)

    print(md)
    if not passed:
        print("Threshold check FAILED.")
        sys.exit(1)
    print("All performance thresholds PASSED.")


if __name__ == "__main__":
    main()
