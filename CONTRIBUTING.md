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

Security problems: please report them privately, see [docs/SECURITY.md](docs/SECURITY.md).
