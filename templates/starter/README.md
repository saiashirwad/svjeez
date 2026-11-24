# svjeez starter

`scene.tsx` is a deploy: a commit types itself in, three stages run with their times counting up, and the new deploy time lands on a chart. Edit it and the preview reloads.

```sh
npm run dev     # live preview with a scrubber
npm run check   # problems with file:line and a fix
npm run svg     # writes scene.svg
```

It uses `svjeez` and three of its add-ons: `@svjeez/code` for the highlighted snippet, `@svjeez/icons` for the Tabler icons and `@svjeez/charts` for the chart. The scene loads Geist (SIL Open Font License) from jsDelivr when it builds, so it needs a network connection.
