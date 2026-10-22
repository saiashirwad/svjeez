import { validateSvg } from "svg-motion";
import { buildStrata } from "../examples/strata";
import { buildTicTacToe } from "../examples/tictactoe";
import { buildNeon } from "../examples/neon";
import { buildEffects } from "../examples/effects";

const targets: Array<[string, () => string]> = [
  ["strata-agents.svg", buildStrata],
  ["tictactoe.svg", buildTicTacToe],
  ["tictactoe-neon.svg", buildNeon],
  ["effects.svg", buildEffects],
];

const xmllint = Bun.which("xmllint");

for (const [output, build] of targets) {
  const svg = build();
  await Bun.write(output, svg);

  const { errors, warnings } = validateSvg(svg);
  if (errors.length > 0) {
    for (const error of errors) console.error(`error: ${error}`);
    process.exit(1);
  }
  for (const warning of warnings) console.warn(`warning: ${warning}`);

  if (xmllint) {
    const result = Bun.spawnSync([xmllint, "--noout", output]);
    if (result.exitCode !== 0) {
      console.error(result.stderr.toString());
      process.exit(1);
    }
  }

  const keyframes = (svg.match(/@keyframes /g) ?? []).length;
  const animations = (svg.match(/animation-name:/g) ?? []).length;
  console.log(`built ${output}`);
  console.log(`  ${(svg.length / 1024).toFixed(1)} KB · ${keyframes} keyframes · ${animations} tracks`);
  console.log(`  ${warnings.length} warnings · xmllint ${xmllint ? "ok" : "not installed"}`);
}
