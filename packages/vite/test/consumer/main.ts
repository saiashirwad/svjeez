/// <reference types="@svjeez/vite/client" />
import scene from "./scene.tsx?svjeez&posters";

const { light, dark }: { light: string; dark: string } = scene.posters;
document.body.innerHTML = `<img src="${scene.src}" width="${scene.width}" height="${scene.height}" alt="${scene.title}"><img src="${light}"><img src="${dark}">`;
