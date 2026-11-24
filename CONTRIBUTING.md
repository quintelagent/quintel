# Contributing

Issues are welcome: a number that looks wrong, a page that breaks, a hole in the method. Small, focused pull requests are too.

## Run it

```bash
npm install
npm test
npm run typecheck
QNTL_API=https://quintelagent.com npm run dev   # the site, with live data
```

## Rules

- **Engine outputs are frozen.** Stored runs must still verify. A change to any simulated number needs a new input version and an entry in the changelog.
- **Plain English.** "Scenario odds", neutral wording, no advice. `npm run check:design` enforces the copy and design rules.
- **No secrets.** A pre-commit hook and CI scan for them.
- **Wallet code gets extra care.** Pull requests that add wallet connections, signatures, approvals or new network hosts are closed unless discussed in an issue first.

## Commits and pull requests

- Small commits, one change each, in plain English, starting with the area: `Site:` `Engine:` `Proof:` `Docs:` `Fix:`.
- Commit dates are real. History on `main` is never rewritten.
- Pull requests follow the template: what changed, why, how it was tested, and a screenshot or clip if it is visible.

## How we ship

1. **One branch per feature.** Design notes, code and tests together, behind a flag that is off. Nothing unreleased is in this repository.
2. **Release.** The branch opens as a pull request, CI passes, it merges with a merge commit, the flag goes on, the site deploys and the live page is checked.
3. **Every release** gets a tag, a GitHub Release in plain English, a changelog entry, a README "Live today" row and a move to Live on [Status](https://quintelagent.com/status).
4. **Small fixes and docs** go straight in as small commits.
5. **Status is the only place for Soon and Planned.** Soon means it already works.
6. **Incidents.** Every outage, wrong number or late fingerprint gets a report the same day, in [INCIDENTS.md](INCIDENTS.md).
7. **Every day** the changelog lists what shipped. **Every week** a release note sums it up.
8. **Dependencies** are reviewed weekly. CI does not stay red.
9. **Honest by default.** The repository shows what is live, what broke and what was fixed.

Security problems: please report them privately, see [SECURITY.md](SECURITY.md).
