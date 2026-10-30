import { ALL_FORMATS, BufferSource, EncodedPacketSink, Input } from "mediabunny";
import { motion, render } from "svjeez";

export const scene = (width: number, height: number) =>
  render(
    { width, height, duration: 1, title: "Slide" },
    <rect
      width={16}
      height={height}
      fill="#3EE6D6"
      animation={motion({ x: 0 }).to({ x: width - 16 }, 1)}
    />,
  );

export const slide = scene(64, 48);

export const read = async (bytes: Uint8Array) => {
  const input = new Input({ source: new BufferSource(bytes), formats: ALL_FORMATS });
  const track = await input.getPrimaryVideoTrack();

  if (!track) throw new Error("the video has no video track");
  let alpha = 0;

  for await (const packet of new EncodedPacketSink(track).packets())
    if (packet.sideData.alpha && packet.sideData.alpha.byteLength > 0) alpha++;

  return {
    mime: await input.getMimeType(),
    codec: await track.getCodec(),
    width: await track.getDisplayWidth(),
    height: await track.getDisplayHeight(),
    packets: (await track.computePacketStats()).packetCount,
    duration: await input.computeDuration(),
    transparent: await track.canBeTransparent(),
    alpha,
  };
};
