import assert from "node:assert/strict";
import { ALL_FORMATS, BufferSource, Input } from "mediabunny";
import { el, motion, render } from "svjeez";
import { renderVideo } from "@svjeez/video";

const svg = render({ width: 64, height: 48, duration: 1, title: "Slide" }, [
  el.rect({ width: 16, height: 48, fill: "#3EE6D6", animation: motion({ x: 0 }).to({ x: 48 }, 1) }),
]);

for (const format of ["mp4", "webm"]) {
  const video = await renderVideo(svg, { format, fps: 10, colorScheme: "light" });
  const input = new Input({ source: new BufferSource(video.bytes), formats: ALL_FORMATS });
  const track = await input.getPrimaryVideoTrack();

  assert.equal(video.frames, 10);
  assert.equal(await track.getCodec(), video.codec);
  assert.equal((await track.computePacketStats()).packetCount, 10);
  assert.equal(await input.computeDuration(), 1);
  console.log(`${format}: ${video.codec}, ${video.frames} frames, ${video.bytes.length} bytes`);
}
