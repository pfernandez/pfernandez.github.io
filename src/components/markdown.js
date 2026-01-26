import { component, div } from '@pfern/elements'
import MarkdownIt from "markdown-it";
import { createMathjaxInstance, mathjax } from "@mdit/plugin-mathjax";

const mathjaxInstance = await createMathjaxInstance({
  output: 'svg', // or 'chtml' for dynamic
  delimiters: 'all' // supports both $...$ and \(...\)
});

const md = MarkdownIt().use(mathjax, mathjaxInstance);

export const markdown = component(string =>
  div({ innerHTML: md.render(string) }))

