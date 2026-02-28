# Principles

## Think Before Coding
Don't assume. Don't hide confusion. Surface tradeoffs.

- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## Simplicity First
Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If 200 lines could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## Surgical Changes
Touch only what you must. Clean up only your own mess.

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.
- Remove imports/variables/functions that YOUR changes made unused.
- NEVER remove pre-existing dead code unless asked.

The test: every changed line should trace directly to the request.

## Goal-Driven Execution
Define success criteria. Loop until verified.

Transform tasks into verifiable goals:
- "Add validation" → write tests for invalid inputs, then make them pass
- "Fix the bug" → write a test that reproduces it, then make it pass
- "Refactor X" → ensure tests pass before and after

For multi-step tasks, state a brief plan:
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]

## Session Workflow
- NEVER finish a session without running tests.
- NEVER finish a session without running pre-commit to format and lint.

## Testing Coverage Expectations
Coverage must be high and meaningful for every change.

- Add or update tests for all changed behavior.
- Maintain strong coverage across:
  - Unit tests
  - Functional tests
  - Integration / E2E tests
- Bug fixes must include a regression test.
- New features should include happy-path + key failure-path tests.
- If full coverage is not feasible, document exact gaps and why.

## Pre-commit Requirements
Use pre-commit hooks as a required quality gate.

- Pre-commit must run formatting and linting checks.
- Hooks should run locally before any commit.
- If hooks fail, fix issues before proceeding.
- Keep hook configuration committed in the repo.

## CI Requirements
CI must enforce migration safety and quality checks.

- Run migrations checks in CI (generation/apply/consistency as appropriate).
- Run lint in CI.
- Run test suites in CI:
  - Unit
  - Functional
  - Integration / E2E
- Failing migrations/lint/tests must block merge.
- Keep CI fast but never skip critical quality gates.

## Security Requirements (Non-Negotiable)
Security is paramount. Treat every change as potentially security-sensitive.

- Never commit secrets, tokens, API keys, credentials, private certs, or `.env` values.
- Secrets must be stored in approved secret managers/vault systems only.
- Use environment variables and secret references, never hardcoded values.
- Never print or log secrets, even in debug output.
- Add/update `.gitignore` and secret scanning rules as needed.
- If a secret leak is suspected:
  1. Stop work and flag incident immediately.
  2. Rotate exposed credentials.
  3. Remove leaked material from code/history using approved process.
  4. Document remediation.

## Repository Scope Rules
This GitHub repository must contain only code and assets that support the Hookwing product and public documentation.

- Do not add internal operations docs to this repo (no internal CEO/marketing/tech runbooks).
- Keep private planning/process notes in private workspace locations, not in the product repo.
- `docs/` in this repo is public-facing product/developer documentation only.

## Security Review Before PR
Every PR must pass security review before being submitted for Fabien review.

- Run automated security checks (SAST/dependency/secret scan) where available.
- Use Codex security review capabilities on the diff before finalizing PR.
- Perform manual security sanity checks on auth, input validation, data exposure, and logging.
- Explicitly call out any residual risks in the PR description.
- No PR submission if security checks are failing or incomplete.
