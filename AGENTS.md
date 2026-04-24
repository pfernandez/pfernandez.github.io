# Repository Guidelines

## Project Structure & Module Organization
Core application code lives in `src/`. `src/index.js` boots the site, `src/components/` holds shared UI/rendering helpers, and `src/pages/` contains page-specific modules and assets. The graph reduction work is isolated under `src/pages/graph-reduction/` with colocated tests such as `graph/*.test.js`, `observer/*.test.js`, and `visualizations/*.test.js`. Build and utility scripts live in `scripts/`. Static content and post markdown belong in `public/`, especially `public/posts/`.

## Build, Test, and Development Commands
Use `npm run dev` to start the Vite dev server. Use `npm run build` to create the production bundle and run prerendering. Use `npm run preview` to serve the built output locally. Use `npm test` to run all `*.test.js` files with Node’s built-in test runner. Use `npm run proofs` for the graph-reduction proof generator, and `npm run prerender` if you only need the prerender step.

## Coding Style & Naming Conventions
This repo uses ES modules and a lightweight functional style. Follow the ESLint config in `eslint.config.js`: 2-space indentation, single quotes, no semicolons, Unix line endings, and short lines where practical. Prefer small, composable functions and keep page-specific logic inside its page directory. Name test files `*.test.js`; use descriptive module names like `collapse.js`, `layout.js`, or `dashboard.js`.

## Testing Guidelines
Tests are colocated with the code they exercise under `src/`. Keep tests focused on observable behavior and small enough to run as part of `npm test`. When changing parsing, reduction, or visualization logic, add or update nearby tests before broad refactors. Use the existing Node test style rather than introducing another framework.

## Commit & Pull Request Guidelines
Recent history favors short, imperative commit messages such as `Cleanup`, `Remove model abstraction`, and `Build graphs from De Brujin indices`. Keep commits focused and easy to scan. Pull requests should include a brief summary, note any affected routes or scripts, and attach screenshots for UI-visible changes. Call out deletions or structural simplifications explicitly so reviewers can evaluate the impact quickly.

## Collaboration Style
This repository is used for discovery, not just implementation. Default to discussion before editing: inspect the current code, summarize observations, state hypotheses clearly, and propose a small patch before making it. Do not make substantial code changes, broad cleanups, or refactors without explicit approval.

When ideas move across domains such as combinators, geometry, lattice paths, causal structure, or diagrammatic analogies, be precise about what kind of claim is being made. Distinguish exact equivalence from encoding, heuristic, or visual metaphor. Favor small, reversible edits that help expose structure over larger “improvements” that might prematurely freeze an evolving idea.

## Content & Deployment Notes
Posts in `public/posts/` become site routes. The site is built with Vite and deployed from `dist/` to `gh-pages`; treat the deployed branch as generated output, not a hand-edited source branch.
