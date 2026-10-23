# Security policy

Thank you for helping keep Planning Poker and the classes that use it safe.

## Reporting a vulnerability

**Please don't open a public issue.** Report it privately through GitHub instead:

1. Go to the repository's **Security** tab.
2. Choose **Report a vulnerability** (GitHub's private vulnerability reporting).
3. Describe the problem, how to reproduce it, and what an attacker could do.

You should get a first response within 7 days. Once a fix is deployed, the advisory is published with credit to you, unless you'd rather stay anonymous.

Please don't include real people's personal information in a report. If you saw any while testing, say so in the report without copying it.

## Supported versions

Only the version deployed from `main` is supported.

## In scope

- Seeing anyone's vote before the facilitator reveals the round.
- Acting as another participant or as the facilitator without their rejoin token.
- Joining or reading a room without its code.
- Injection (SQL, cross-site scripting, CSV formulas) or reading other rooms' data.
- Ways to take the service down that bypass its rate and size limits.
- Secrets or personal data exposed in the repository or published images.

## Out of scope

- Guessing a room code that someone shared publicly. Room codes are the invitation by design, and facilitators can remove people.
- Volumetric denial-of-service attacks.
- Findings that need physical or administrator access to the server.

## Please don't

- Test against rooms you aren't part of, or disrupt a class session in progress.
- Run automated scanners against the production site. A local copy (`README.md`) has everything you need.
