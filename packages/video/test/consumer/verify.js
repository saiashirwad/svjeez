import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ALL_FORMATS, BufferSource, Input } from "mediabunny";
import { motion, render } from "svjeez";
import { el } from "svjeez/internal";
import { video } from "@svjeez/video";

const svg = render({ width: 64, height: 48, duration: 1, title: "Slide" }, [
  el.rect({ width: 16, height: 48, fill: "#3EE6D6", animation: motion({ x: 0 }).to({ x: 48 }, 1) }),
]);

for (const format of ["mp4", "webm"]) {
  const clip = await video(svg, { format, fps: 10, colorScheme: "light" });
  const input = new Input({ source: new BufferSource(clip.bytes), formats: ALL_FORMATS });
  const track = await input.getPrimaryVideoTrack();

  assert.equal(clip.frames, 10);
  assert.equal(await track.getCodec(), clip.codec);
  assert.equal((await track.computePacketStats()).packetCount, 10);
  assert.equal(await input.computeDuration(), 1);
  console.log(`${format}: ${clip.codec}, ${clip.frames} frames, ${clip.bytes.length} bytes`);
}

const dir = mkdtempSync(join(tmpdir(), "svjeez-video-consumer-"));

try {
  writeFileSync(join(dir, "scene.svg"), svg);
  execFileSync("npx", [
    "svjeez",
    "video",
    join(dir, "scene.svg"),
    "--out",
    join(dir, "scene.webm"),
    "--fps",
    "5",
  ]);

  const input = new Input({
    source: new BufferSource(readFileSync(join(dir, "scene.webm"))),
    formats: ALL_FORMATS,
  });

  assert.equal((await (await input.getPrimaryVideoTrack()).computePacketStats()).packetCount, 5);
  console.log("svjeez video found @svjeez/video and wrote scene.webm");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
