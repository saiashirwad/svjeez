/// <reference types="@svjeez/vite/client" />
import scene from "./scene.tsx?svjeez&posters";

const [{ src: light }] = scene.posters.light;
const [{ src: dark }] = scene.posters.dark;

document.body.innerHTML = `<img src="${scene.src}" width="${scene.width}" height="${scene.height}" alt="${scene.title}"><img src="${light}"><img src="${dark}">`;
