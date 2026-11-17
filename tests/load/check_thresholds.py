"""
Evaluate Locust CSV performance statistics against SLA thresholds.

Exits with status code 1 if any threshold (response time, p95, throughput RPS,
or error rate %) is breached, failing the GitHub Actions CI/CD workflow.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path
from typing import Any, Dict, List


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None or str(value).strip() in ("", "N/A"):
            return default
        return float(value)
    except (ValueError, TypeError):
        return default


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return default


def evaluate_stats(
    stats_csv: Path,
    profile: str,
    concurrent_users: int,
    max_avg_ms: float,
    max_p95_ms: float,
    max_error_rate: float,
    min_rps: float,
) -> Dict[str, Any]:
    if not stats_csv.exists():
        raise FileNotFoundError(f"Locust stats CSV not found: {stats_csv}")

    endpoints: List[Dict[str, Any]] = []
    aggregated: Dict[str, str] | None = None

    with stats_csv.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            name = (row.get("Name") or "").strip()
            if name == "Aggregated":
                aggregated = row
            else:
                req_cnt = _safe_int(row.get("Request Count"))
                fail_cnt = _safe_int(row.get("Failure Count"))
                err_pct = (fail_cnt / req_cnt * 100.0) if req_cnt > 0 else 0.0
                endpoints.append({
                    "method": (row.get("Type") or "").strip(),
                    "name": name,
                    "requests": req_cnt,
                    "failures": fail_cnt,
                    "error_rate_pct": round(err_pct, 2),
                    "avg_ms": round(_safe_float(row.get("Average Response Time")), 2),
                    "median_ms": round(_safe_float(row.get("Median Response Time")), 2),
                    "p95_ms": round(_safe_float(row.get("95%")), 2),
                    "p99_ms": round(_safe_float(row.get("99%")), 2),
                    "max_ms": round(_safe_float(row.get("Max Response Time")), 2),
                    "rps": round(_safe_float(row.get("Requests/s")), 2),
                })

    if aggregated is None:
        raise RuntimeError(f"'Aggregated' summary row missing from {stats_csv}")

    total_requests = _safe_int(aggregated.get("Request Count"))
    total_failures = _safe_int(aggregated.get("Failure Count"))
    avg_ms = round(_safe_float(aggregated.get("Average Response Time")), 2)
    median_ms = round(_safe_float(aggregated.get("Median Response Time")), 2)
    p95_ms = round(_safe_float(aggregated.get("95%")), 2)
    p99_ms = round(_safe_float(aggregated.get("99%")), 2)
    max_ms = round(_safe_float(aggregated.get("Max Response Time")), 2)
    rps = round(_safe_float(aggregated.get("Requests/s")), 2)
    error_rate_pct = round((total_failures / total_requests * 100.0), 3) if total_requests > 0 else 100.0

    violations: List[str] = []
    if total_requests <= 0:
        violations.append("No requests were executed (total_requests == 0).")
    if avg_ms > max_avg_ms:
        violations.append(f"Average response time {avg_ms} ms exceeded threshold {max_avg_ms} ms.")
    if p95_ms > max_p95_ms:
        violations.append(f"P95 response time {p95_ms} ms exceeded threshold {max_p95_ms} ms.")
    if error_rate_pct > max_error_rate:
        violations.append(f"Error rate {error_rate_pct}% exceeded threshold {max_error_rate}%.")
    if rps < min_rps:
        violations.append(f"Throughput {rps} req/s is below minimum threshold {min_rps} req/s.")

    return {
        "profile": profile,
        "concurrent_users": concurrent_users,
        "passed": len(violations) == 0,
        "metrics": {
            "total_requests": total_requests,
            "total_failures": total_failures,
            "error_rate_pct": error_rate_pct,
            "throughput_rps": rps,
            "avg_response_ms": avg_ms,
            "median_response_ms": median_ms,
            "p95_response_ms": p95_ms,
            "p99_response_ms": p99_ms,
            "max_response_ms": max_ms,
        },
        "thresholds": {
            "max_avg_ms": max_avg_ms,
            "max_p95_ms": max_p95_ms,
            "max_error_rate_pct": max_error_rate,
            "min_rps": min_rps,
        },
        "violations": violations,
        "endpoints": endpoints,
    }


def render_markdown(result: Dict[str, Any]) -> str:
    m = result["metrics"]
    t = result["thresholds"]
    status_badge = "PASS" if result["passed"] else "FAIL"

    lines = [
        f"## Load Test Report — `{result['profile'].upper()}` Traffic ({result['concurrent_users']} Concurrent Users) — **{status_badge}**",
        "",
        "| Metric | Measured | Threshold | Status |",
        "| --- | ---: | ---: | :---: |",
        f"| Total Requests | {m['total_requests']} | > 0 | {'PASS' if m['total_requests'] > 0 else 'FAIL'} |",
        f"| Throughput (RPS) | {m['throughput_rps']} req/s | >= {t['min_rps']} req/s | {'PASS' if m['throughput_rps'] >= t['min_rps'] else 'FAIL'} |",
        f"| Avg Response Time | {m['avg_response_ms']} ms | <= {t['max_avg_ms']} ms | {'PASS' if m['avg_response_ms'] <= t['max_avg_ms'] else 'FAIL'} |",
        f"| Median (P50) Response Time | {m['median_response_ms']} ms | — | INFO |",
        f"| P95 Response Time | {m['p95_response_ms']} ms | <= {t['max_p95_ms']} ms | {'PASS' if m['p95_response_ms'] <= t['max_p95_ms'] else 'FAIL'} |",
        f"| P99 Response Time | {m['p99_response_ms']} ms | — | INFO |",
        f"| Max Response Time | {m['max_response_ms']} ms | — | INFO |",
        f"| Error Rate | {m['error_rate_pct']}% ({m['total_failures']} failures) | <= {t['max_error_rate_pct']}% | {'PASS' if m['error_rate_pct'] <= t['max_error_rate_pct'] else 'FAIL'} |",
        "",
        "### Per-Endpoint Breakdown",
        "",
        "| Endpoint | Requests | Failures | Error % | Avg (ms) | P95 (ms) | RPS |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]

    for ep in result["endpoints"]:
        lines.append(
            f"| `{ep['name']}` | {ep['requests']} | {ep['failures']} | "
            f"{ep['error_rate_pct']}% | {ep['avg_ms']} | {ep['p95_ms']} | {ep['rps']} |"
        )

    if result["violations"]:
        lines.extend(["", "### Threshold Violations", ""])
        for v in result["violations"]:
            lines.append(f"- {v}")

    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate Locust load test metrics against SLA thresholds.")
    parser.add_argument("--csv-prefix", required=True, help="Locust CSV output prefix (without _stats.csv).")
    parser.add_argument("--profile", required=True, help="Traffic profile label (e.g., normal, heavy).")
    parser.add_argument("--users", type=int, default=15, help="Number of concurrent users simulated.")
    parser.add_argument("--max-avg-ms", type=float, required=True, help="Maximum allowed average latency in ms.")
    parser.add_argument("--max-p95-ms", type=float, required=True, help="Maximum allowed P95 latency in ms.")
    parser.add_argument("--max-error-rate", type=float, required=True, help="Maximum allowed error rate percentage.")
    parser.add_argument("--min-rps", type=float, required=True, help="Minimum required requests per second.")
    parser.add_argument("--summary-md", default="", help="Optional path to write Markdown summary.")
    parser.add_argument("--summary-json", default="", help="Optional path to write JSON metrics summary.")
    args = parser.parse_args()

    stats_csv = Path(f"{args.csv_prefix}_stats.csv")
    result = evaluate_stats(
        stats_csv=stats_csv,
        profile=args.profile,
        concurrent_users=args.users,
        max_avg_ms=args.max_avg_ms,
        max_p95_ms=args.max_p95_ms,
        max_error_rate=args.max_error_rate,
        min_rps=args.min_rps,
    )

    markdown = render_markdown(result)
    print(markdown)

    if args.summary_md:
        md_path = Path(args.summary_md)
        md_path.parent.mkdir(parents=True, exist_ok=True)
        md_path.write_text(markdown, encoding="utf-8")

    if args.summary_json:
        json_path = Path(args.summary_json)
        json_path.parent.mkdir(parents=True, exist_ok=True)
        json_path.write_text(json.dumps(result, indent=2), encoding="utf-8")

    if not result["passed"]:
        print(f"ERROR: Load test '{args.profile}' failed performance thresholds.", file=sys.stderr)
        return 1

    print(f"SUCCESS: Load test '{args.profile}' met all performance thresholds.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
