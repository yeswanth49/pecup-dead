In docs/fetch-fast/19_load_testing.md around lines 14 to 15, the Validation criteria entry is vague because it references "targets" without specifying them; update this section to list concrete, measurable performance targets (e.g., P50/P95/P99 latency thresholds in ms, acceptable error rate as a percentage, throughput in requests/sec, and any SLA for percent of successful requests) and include the test conditions (payload sizes, concurrency levels, test duration) so the validation can be reproduced and measured against these exact numbers.### Task 19: Load testing with realistic user scenarios

- **Objective**: Validate performance under concurrent usage and varied user contexts.

- **Approach**:
  - Use k6, Artillery, or Locust to simulate traffic to `/api/bulk-academic-data`.
  - Prepare fixtures for multiple branches/years/semesters if needed.

- **Steps (k6 example)**:
  1. Write a script that hits the endpoint with authenticated requests (cookie or token per VU).
  2. Ramp to realistic RPS; measure latency percentiles and error rates.
  3. Observe DB impact; verify queries remain efficient.

- **Validation criteria**:
  - Latency targets (ms): P50 ≤ 150, P95 ≤ 400, P99 ≤ 800
  - Throughput: sustain ≥ 25 requests/sec during peak test window
  - Error rate: ≤ 0.5% (HTTP 5xx/4xx excluding expected 401s for unauth)
  - Success SLA: ≥ 99.5% successful responses over the measured window
  - Optional infra metrics (if available): server CPU avg ≤ 70%; DB query P95 ≤ 300 ms

  - Test conditions (reproducible):
    - Authentication: valid session cookie/token per VU; no client-side retries
    - Concurrency profiles:
      - Smoke: 1 VU, ~1 rps, 2 min
      - Typical: ramp 1 → 25 VUs over 2 min, hold 25 VUs for 8 min
      - Peak: ramp 25 → 50 VUs over 2 min, hold 50 VUs for 10 min
    - Target request rate: ~12–15 rps during Typical; ~25–30 rps during Peak
    - Payload/response: default endpoint parameters; record response size (expected ~8–30 KB)
    - Cache state: perform 1-minute warm-up; exclude warm-up from metrics
    - Environment: staging/prod-equivalent with prod-like DB indexes and Supabase tier
    - Data coverage: fixtures across ≥ 3 branches × 4 years × 2 semesters

- **Completion checklist**:
  - [ ] Load script committed under `docs/fetch-fast/artifacts/`
  - [ ] Results captured and analyzed
