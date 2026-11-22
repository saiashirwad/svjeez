# @svjeez/live

Read, edit and run a `svjeez` scene's source from a program: a parser, minimal-diff edits and a sandboxed compiler with pluggable runners. Headless and Effect-native.

```sh
npm i svjeez@next @svjeez/live@next effect
```

- `parse`, `locate` and `elementAt` read a scene's source and find its elements.
- `edit` and `defineEdit` change it with the smallest text diff.
- `compile` runs it through a `Runner`: `BunRunner`, `BrowserRunner` or `WorkerLoaderRunner`.
- `Session` holds a scene's source and applies edits to it over time.

`examples/live-editor` in the repository is a React playground built on it.
