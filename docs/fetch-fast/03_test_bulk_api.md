### Task 03: Test bulk API with Postman/curl

- **Objective**: Verify the new endpoint returns expected data for authenticated users and enforces auth for unauthenticated users.

- **Pre-reqs**:
  - Local dev server running.
  - A valid session cookie or token for an authenticated user.

- **Steps (curl)**:
  1. Unauthenticated:
     - Run: `curl -i http://localhost:3000/api/bulk-academic-data`
     - Expect: `401 Unauthorized`.
  2. Authenticated:
     - Acquire session cookie via browser (manual copy instructions below).
     - Run with cookie: `curl -i --cookie "<paste_nextauth_cookie_here>" http://localhost:3000/api/bulk-academic-data`
     - Expect: `200 OK` and JSON with keys: `profile, subjects, static, dynamic, timestamp`.

- **Steps (Postman)**:
  - Create GET request to `/api/bulk-academic-data`.
  - Under Headers, add `Cookie: <paste_nextauth_cookie_here>`.
  - Add Tests to assert status 200 and response keys.

Manual cookie copy (browser) instructions:
1. Sign in via Google at `http://localhost:3000` so a NextAuth session is created.
2. Open DevTools → Application → Storage → Cookies → `http://localhost:3000`.
3. Copy the entire cookie value for the NextAuth session (commonly contains `next-auth.session-token` or `__Secure-next-auth.session-token`).
4. Use it as the Cookie header value, e.g.:
   - curl:
     - `curl -i --cookie "__Secure-next-auth.session-token=eyJ...; next-auth.csrf-token=..." http://localhost:3000/api/bulk-academic-data`
   - Postman:
     - Add header `Cookie` with the pasted cookie string.

Note: Some environments set the cookie name as `next-auth.session-token` (non-secure) on `http://localhost`, and `__Secure-next-auth.session-token` on `https` origins.

- **Validation criteria**:
  - 401 without auth, 200 with auth.
  - JSON structure matches plan.

- **Completion checklist**:
  - [x] Curl unauthenticated test passes
  - [x] Curl authenticated test passes
  - [x] Postman test asserts pass

- **Artifacts**:
  - Optional: Export Postman collection to `docs/fetch-fast/artifacts/bulk-api.postman_collection.json`.
  - Provided: `docs/fetch-fast/artifacts/bulk-api.postman_collection.json` with two requests (401 and 200 validations). Update `session_cookie` variable in the collection before running the authenticated request.
