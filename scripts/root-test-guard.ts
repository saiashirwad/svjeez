// Each workspace sets its own JSX runtime and test setup, which `bun test` at the root never reads.
console.error(
  "Run `bun run test` at the root, or `bun test` inside a workspace such as packages/svjeez.",
);

process.exit(1);
