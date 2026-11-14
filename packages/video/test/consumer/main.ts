import { video, type Video, type VideoOptions } from "@svjeez/video";

const options: VideoOptions = { format: "webm", codec: "vp8", fps: 24, background: "transparent" };

// @ts-expect-error mp4 cannot hold VP8
const wrong: VideoOptions = { format: "mp4", codec: "vp8" };

export const clip: Promise<Video> = video("<svg/>", options);

export { wrong };
