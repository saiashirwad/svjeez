import type { APIRoute } from "astro";
import { iconPng, png } from "../icon";

export const GET: APIRoute = async () => png(await iconPng(32));
