import bash from "shiki/langs/bash.mjs";
import css from "shiki/langs/css.mjs";
import diff from "shiki/langs/diff.mjs";
import go from "shiki/langs/go.mjs";
import html from "shiki/langs/html.mjs";
import javascript from "shiki/langs/javascript.mjs";
import json from "shiki/langs/json.mjs";
import jsx from "shiki/langs/jsx.mjs";
import markdown from "shiki/langs/markdown.mjs";
import python from "shiki/langs/python.mjs";
import rust from "shiki/langs/rust.mjs";
import sql from "shiki/langs/sql.mjs";
import tsx from "shiki/langs/tsx.mjs";
import typescript from "shiki/langs/typescript.mjs";
import yaml from "shiki/langs/yaml.mjs";

/** Names and aliases that `highlight()` accepts without `grammars`. */
export type DefaultLang =
  | "ts" | "typescript" | "tsx" | "js" | "javascript" | "jsx"
  | "json" | "css" | "html"
  | "bash" | "sh" | "shell" | "zsh"
  | "python" | "py" | "rust" | "rs" | "go" | "sql" | "yaml" | "yml"
  | "md" | "markdown" | "diff";

export const LANGS = [
  bash, css, diff, go, html, javascript, json, jsx, markdown, python, rust, sql, tsx, typescript, yaml,
];
