import { createServer } from "vite";
import { appConfig } from "./config.ts";

const server = await createServer(appConfig());

await server.listen();

server.printUrls();
