# pfernandez.github.io

Personal site built with Vite and `@pfern/elements`.

## Local development

```bash
npm install
npm run dev
```

## Writing posts

Posts live in `public/md/`:

- `public/md/home.md` is served at `/` and `/md/home`
- `public/md/test.md` is served at `/md/test`

## Math

Math support is lazy-loaded: pages render immediately with `markdown-it`, and
MathJax is only loaded when the post contains `$...$`, `\\( ... \\)`, or
`\\[ ... \\]`.

## Deployment

GitHub Actions builds `dist/` and deploys it to the `gh-pages` branch. The
`gh-pages` branch is treated as an artifact (no direct commits).

