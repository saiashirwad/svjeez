# Minecraft example (poteto-mode, Feature playbook)

- [x] 1. `how` over the affected subsystem. (done inline: read src/*, manifold example, build script; grounding at scratchpad/arch/grounding.md)
- [x] 2. `architect` for parallel design exploration. (3 runners converged; base opus; scratchpad/arch/design.md. Cross-judge skipped: convergence)
- [x] 3. Write the throughput checkpoint as four todo items.
  - [x] Blocking first steps: library (src/voxel + painter + tests) before the example can build.
  - [x] Independent workstreams: n/a for parallel: the example imports the library; serialize library -> example.
  - [x] Shared mutable state: each owner gets its own worktree/branch (../svjeez-voxel on `voxel`).
  - [x] Smallest safe decomposition: after the user cut mobs, one sonnet owner does library then example sequentially (code-coupled, no subtle solver left).
- [x] 4. Delegate code-writing to a subagent using your configured feature model.
- [x] 5. Verify on the matching surface.
- [x] 6. Rebase into small, ordered commits. Stack follow-ups.
- [x] 7. skip: design not contested (3 runners converged)
- [x] 8. Run **Opening a PR**. #7 (voxel-scene -> main), #8 (minecraft -> voxel-scene). deslop/no-comments skipped: diff reviewed, no line comments

Task todos
- [x] Prototype: do CSS animations inside <use>-referenced symbols run in chromium/firefox/webkit? Scale numbers.
- [ ] Library: ortho voxel module
- [ ] Example: examples/minecraft, 60s
