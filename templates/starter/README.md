# svjeez starter

`scene.tsx` is a deploy: a commit types itself in, three stages run with their times counting up, and the new deploy time lands on a chart. Edit it and the preview reloads.

```sh
npm run dev     # live preview with a scrubber
npm run check   # problems with file:line and a fix
npm run svg     # writes scene.svg
```

It uses `svjeez` and four of its add-ons: `@svjeez/code` for the highlighted snippet, `@svjeez/icons` for the Tabler icons, `@svjeez/charts` for the chart and `@svjeez/fonts` for Geist and Geist Mono (SIL Open Font License), which it fetches from Google Fonts on the first build and caches, so that build needs a network connection.
