# AI Dispatch Prototype Work Log

## Approval rules

- The user requested approval before any action.
- The user approved read-only repository inspection and creation of this log.
- Code changes, data generation, database writes, external API calls, deployments, commits, and pushes require separate approval before execution.
- Do not seed citizens or reports in the live database. Any synthetic dispatch dataset must be isolated from production data.

## 2026-11-10 — Initial authorized inspection

### Actions performed

1. Read Git status, recent commit history, and the repository's top-level entries.
2. Searched the backend for report/contractor models, mayor review routes, demo seed functions, and startup behavior.
3. Checked for existing backend test files.
4. Searched mayor UI files for the current queue, review, and contractor assignment flow.
5. Read the report, contractor, citizen, and review-input model definitions.
6. Read the stats route and backend startup hook.
7. Read backend dependency declarations.
8. Created this work log.

No application code was changed, no records were generated or written, and no credentials were opened.

### Findings

- The backend uses Firestore through `backend/firebase_store.py`.
- `Report` currently represents an individual report, with location, severity, evidence, status, reporter count, and optional contractor assignment.
- `Contractor` currently has identity, specialty, rating, completed-job count, and verification state; it has no dispatch territory, capacity, or availability fields.
- The mayor flow reviews a single report and assigns a contractor through `POST /reports/{report_id}/review`.
- The existing `ensure_demo_contractors()` helper creates only the three demo contractors. The current startup hook calls this helper only when `DEMO_SEED=true`.
- A separate legacy `seed_demo_data()` function still contains code that can delete and recreate reports, contractors, and citizens. It is not called by the current startup hook, but must not be used for the dispatch prototype.
- No backend test files matching `backend/**/*test*.py` were found in the initial test-file search.
- The local branch was synchronized with `origin/main` at commit `3ed9ede` during inspection. There are unrelated uncommitted Android/build changes in the worktree; they must be preserved.

### Proposed next steps — approval required before each

1. Propose the isolated synthetic-data format and storage location (prefer an in-memory or local fixture/simulator first; no Firestore writes).
2. After approval, implement a deterministic generator for 100 synthetic reports with known incident groups and expected dispatch outputs.
3. After approval, implement and test the dispatch agent against the synthetic dataset, with an explicit run log and idempotent simulation assignments.
4. After approval, add a minimal mayor-facing demo screen or command to run and inspect the simulation.
5. Run targeted tests and report grouping/assignment accuracy, latency, and model token cost.
6. Ask separately before any live-database access, production seeding, deployment, commit, or push.

## 2026-11-10 — Approved synthetic dataset and tests

### Actions performed

1. Rechecked the worktree and confirmed the existing Android/build changes were still present; left them untouched.
2. Read the report model, damage-type options, backend pytest configuration, requirements, and Firestore adapter to keep the fixture compatible while avoiding database access.
3. Added `backend/dispatch_demo_data.py`, a deterministic, standard-library-only generator for 100 synthetic reports across 20 labeled incidents. Each incident has five reports; expected incident labels are stored separately from report inputs.
4. Included synthetic pothole, cracking, sunken-road, broken-manhole, waterlogged-road, and illegal-garbage-dump examples. Garbage reports use the existing `other` damage type.
5. Added four focused checks in `backend/tests/test_dispatch_demo_data.py` for record/group counts, label separation, supported categories, garbage cases, and determinism.
6. Ran `python -m py_compile dispatch_demo_data.py tests\test_dispatch_demo_data.py` successfully, then loaded the test file with `runpy` and directly executed all four test functions successfully.
7. Attempted `python -m pytest -q tests\test_dispatch_demo_data.py`; it could not start because `pytest` is not installed in the active Python environment (`No module named pytest`). Did not install packages.
8. Checked Git status and ran `git diff --check`. The check exited successfully; it emitted line-ending advisories for pre-existing Android/frontend files only.

No Firestore collections, external APIs, or production app flows were accessed or changed. No agent logic, UI, database schema, synthetic persistent records, commit, or push has been created.

### Approval required to continue

The next step would be to add the model-backed grouping/evaluation path that consumes only the synthetic reports and compares its output with the separate expected labels. This would require an external model API call and must be approved separately before implementation or execution.

## 2026-11-10 — Synthetic dispatch agent and mayor demo

The user asked that work proceed without additional approval checkpoints.

### Actions performed

1. Re-read the existing OpenAI request helper, report API, mayor queue, typed frontend API, app theme, and README conventions.
2. Extended the existing OpenAI helper with a JSON-only completion method that returns provider token usage when available; existing image-analysis callers continue using the same response-only helper.
3. Added `backend/dispatch_agent.py`. It sends only generated report inputs to the configured model, validates that every synthetic report is assigned exactly once, rejects unknown IDs/categories/priorities, scores predicted groups against labels kept out of the prompt, and suggests only simulated crews with code-enforced category eligibility and capacity.
4. Added a five-minute, process-local result cache to reduce repeat model charges. This is explicitly not shared rate limiting or access control.
5. Added `POST /api/mayor/dispatch-demo/run`; it executes the synchronous model call in FastAPI's thread pool, does not read or write Firestore, and returns explicit provider/validation errors.
6. Added a mayor queue entry point and `frontend/app/mayor/dispatch-demo.tsx`, showing generated-data notice, loading/error states, incident groups, priorities, simulated crew workload, grouping metrics, latency, and token usage.
7. Added backend tests for the agent, provider helper, route error behavior, cache reuse, and synthetic fixture. Updated README with the simulation limits and focused test command.
8. Installed the already-declared `pytest` and `pytest-xdist` packages with `python -m pip install pytest pytest-xdist`; no dependency manifest was changed.
9. Ran the focused backend suite: 12 passed. Python compilation and route registration smoke check passed. Targeted frontend ESLint and `npx tsc --noEmit` passed.
10. Checked Pylance diagnostics: new service and dataset source files have no diagnostics. Pylance's selected editor environment does not contain `pytest` (and also lacks pre-existing backend dependencies `PIL`, `dotenv`, and `firebase_admin`); the terminal Python 3.13 environment used for the passing test run has the declared test runner installed. The editor interpreter was not changed.

No actual model/API request was made, so no model tokens or API charges were incurred or measured. No live reports, Firestore data, contractors, or external storage were accessed. The demo endpoint is not authenticated; use it only in a trusted test deployment until server-side mayor authentication and shared rate limits exist. Existing unrelated Android/frontend build changes remain untouched.

### Commit and push

Not yet performed when this section was first written; see the completion entry below.

## 2026-11-10 — Commit and push completed

- Committed the synthetic dispatch implementation as `17bd61a` (`Add synthetic AI dispatch demo`).
- Pushed `main` to `origin/main` successfully.
- Only the 14 dispatch implementation, test, UI, documentation, and work-log files were included.
- Unrelated Android/frontend build changes remain unstaged and uncommitted.

## 2026-11-10 — Live synthetic demo attempt

- The local backend had no `OPENAI_API_KEY`; the direct local attempt stopped before sending a model request.
- Found the frontend's configured public backend URL and sent one `POST /api/mayor/dispatch-demo/run` request, which uses the deployment's existing server-side key and synthetic reports only.
- The HTTP request produced no response after an extended wait and was stopped. It is unknown whether the deployed server completed the run; therefore token usage, result quality, and charge are unknown.
- Did not retry, to avoid accidentally creating a duplicate billable model request.
- No local Firestore access was made.
- The user confirmed the model key is configured in Render. The local key absence is therefore not a blocker for the deployed endpoint.
- Follow-up, non-billable `GET /docs` health check to the configured Render host also timed out after 20 seconds with no response. This supports a deployment/service responsiveness issue; it does not establish whether the earlier model request completed.

## 2026-11-10 — Dispatch agent removed

The user confirmed that the app without the dispatch agent is the final direction for now and asked to remove the agent.

- Removed the synthetic dispatch screen, mayor queue entry point, API method/types, backend demo route, model JSON helper, synthetic generator, and dispatch-only tests.
- Removed dispatch-specific README instructions.
- Preserved the existing report review and individual contractor assignment workflow.
- Preserved this work log as a record of the implementation, deployment attempt, and removal.
- Did not access or modify Render configuration or production data.
- Existing unrelated Android/frontend changes remain untouched.
