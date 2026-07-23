# The Office of Interim Comedy

A small static web application for keeping a daily standup joke tradition alive while the usual team joker is away.

The site shows today&apos;s assigned temporary jester, suggested jokes, a custom joke form, the explicit schedule, and the complete archive. Submissions are authenticated through GitHub Issues and processed by GitHub Actions. There is no backend server, no external database, no OAuth app, and no browser-exposed token.

## Architecture

- GitHub Pages hosts the static Vite site.
- React and TypeScript render configuration from JSON files in `data/`.
- GitHub Issues provide the authenticated submission mechanism.
- `scripts/record-joke.mjs` validates issue submissions and updates `data/archive.json`.
- GitHub Actions commits accepted archive updates and deploys Pages in the same workflow.
- `scripts/validate-data.mjs` checks configuration before tests and builds.

GitHub Issues are used instead of direct browser writes because the browser is untrusted. The app only opens a pre-filled issue URL. GitHub supplies the authenticated submitter as `github.event.issue.user.login`, and the workflow trusts that value instead of any name, email, or username written in the issue body.

## Local Development

Install dependencies:

```sh
npm install
```

Run the app:

```sh
npm run dev
```

Run validation, tests, linting, and production build:

```sh
npm run validate:data
npm test
npm run lint
npm run build
```

Format files:

```sh
npm run format
```

## Repository Setup

Before pushing to GitHub:

1. Confirm `src/lib/config.ts` points at the GitHub repository.
2. If the repository name differs, set `VITE_REPOSITORY_NAME` or `VITE_BASE_PATH` for builds, or update the default in `vite.config.ts`.
3. Update `data/team.json` with allowed GitHub usernames and display names.
4. Update `data/schedule.json` with explicit working-day assignments.
5. Add, remove, or edit local suggestions in `data/suggestions.json`.
6. Enable GitHub Issues.
7. Add the `daily-joke` label. The workflow also uses `joke-rejected` when practical.
8. Enable GitHub Pages and select GitHub Actions as the source.
9. In repository Actions settings, allow GitHub Actions to read and write repository contents.
10. Push to `main`.

The deployment workflow runs on pushes to `main`. The joke recording workflow runs when a matching issue is opened, validates the authenticated author, updates `data/archive.json`, commits the change, builds, and deploys Pages without relying on a second workflow trigger.

## Configuration

`data/team.json` uses GitHub usernames as authoritative identity:

```json
{
  "members": [
    {
      "github": "alice-gh",
      "name": "Alice"
    }
  ]
}
```

Do not add employee email addresses. They are not needed and should not be exposed in a static site.

`data/schedule.json` uses explicit dates:

```json
{
  "timezone": "Africa/Johannesburg",
  "entries": [
    {
      "date": "2026-07-27",
      "github": "alice-gh"
    }
  ]
}
```

This keeps leave, holidays, and swaps simple. The frontend calculates today using the configured timezone with `Intl.DateTimeFormat`.

`data/archive.json` is written by the Action. It remains sorted by date ascending and permits only one joke per date.

## Submission Flow

The static app builds a normal pre-filled GitHub issue URL. It includes a deterministic marker block:

```md
<!-- daily-joke-submission:start -->
<!-- version:1 -->
<!-- date:2026-07-27 -->
<!-- type:single -->

### Text

The joke text.

<!-- daily-joke-submission:end -->
```

The Action rejects submissions when the author is unknown, the author is not assigned, the date is invalid or unscheduled, a date is duplicated, fields are missing or too long, markers are malformed, the format version is unsupported, or raw HTML/script-like content is submitted.

Accepted issues are commented on and closed. Rejected issues receive a clear comment, get `joke-rejected` when possible, and remain open so the filing can be corrected.

## Security Assumptions

The frontend is untrusted. It never receives a GitHub token and never calls authenticated GitHub APIs. Joke content is treated as plain text and rendered by React without `dangerouslySetInnerHTML`.

Access control is provided by GitHub repository access and workflow validation. If the repository is public, anyone with a GitHub account may be able to open an issue, but unauthorized authors are rejected. For stricter privacy, use a private repository or restrict issue access. GitHub Pages visibility for private repositories depends on your GitHub plan and organization settings.

The only runtime secret is the automatically generated `GITHUB_TOKEN` in GitHub Actions.

## Printing

Open the Archive section and choose **Print archive**. The print stylesheet hides navigation, forms, buttons, controls, and schedule clutter so the collected jokes can be saved as PDF or printed.

## Troubleshooting

- Issue opens in the wrong repository: update `src/lib/config.ts`.
- Site assets 404 on Pages: confirm the Vite base path in `vite.config.ts` matches the repository name or set `VITE_BASE_PATH`.
- Submission is rejected as unauthorized: check `data/team.json` against the submitter&apos;s GitHub username.
- Submission is rejected as not assigned: check `data/schedule.json` for the submitted date.
- Duplicate date rejected: `data/archive.json` already has an entry for that date.
- Workflow cannot push: allow Actions read/write permissions in repository settings.
- Pages does not deploy: enable GitHub Pages with GitHub Actions as the source.
