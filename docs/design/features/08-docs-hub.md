# 08 · Docs hub + /incidents

**Flag:** none — launch · **Phase:** P0 · **Location:** `/docs`, `/docs/:slug`, `/incidents`; footer "Docs" group; home closing button "Read the docs"

## Purpose
One clean place for every document that explains, proves and limits Quintel.

## Layout — /docs (phone)
H1: "Docs." Sub: "How Quintel works, how to check it, and what it can't do."
Stacked Cards (title, one line, "Read"):
| Doc | One line |
|---|---|
| README | "Start here." |
| Methodology | "How the five models and 1,000,000 futures work." |
| Proof | "How hourly fingerprints let anyone check a run." |
| Limits | "What Quintel can't tell you." |
| Security | "Keys, contracts and how we handle them." |
| Deployments | "Every contract and service, with addresses." |
| Changelog | "Everything we've shipped." |
| Incidents | "Anything that broke, and what we did about it." |

Laptop: 2-column grid (3 at 1100px+).

## Layout — /docs/:slug
Phone: section picker dropdown at top, then article (680px, 18px body), CodeBlock with Copy, "Edit on GitHub" link at bottom. Laptop: left sidebar (all docs), article center, "On this page" links right.

## Layout — /incidents
H1: "Incidents." Sub: "Anything that broke, when, and what we did." List of Cards (date ET, title, status Pill "Resolved"/"Investigating", 2-line summary). Empty: EmptyState "No incidents so far."

## States
Loading: Skeleton article lines. Missing doc: 404 page.

## Data
Render the repo's markdown files (README.md, docs/*.md, CHANGELOG.md, incidents) at build time. One source; GitHub and the site always match.

## Reuses
Section, Card, CodeBlock, CopyButton, Pill, EmptyState, Skeleton.
