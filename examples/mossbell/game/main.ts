import { mount } from "@svjeez/play";
import { DEFAULT_LOOK } from "../art/character";
import { buildWorld } from "../art/world";
import { createHud } from "./hud";
import { mossbell, SAVED, type Villager } from "./rules";
import "./style.css";

const host = document.querySelector<HTMLElement>("#game");

if (!host) throw new Error("The page has no #game element.");

const saved = (): Villager | undefined => {
  try {
    const { name, look }: Partial<Villager> = JSON.parse(localStorage.getItem(SAVED) ?? "{}");

    return { name: name ?? "", look: { ...DEFAULT_LOOK, ...look } };
  } catch {
    return undefined;
  }
};

mount(mossbell(buildWorld(), saved()), host, { view: { width: 860, height: 540 }, hud: createHud });
