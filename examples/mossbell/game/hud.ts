import { CROPS, type CropKind } from "../art/crops";
import type { Look } from "../art/character";
import { createSprite } from "../play/sprite";
import { el, frameOf } from "./dom";
import { cropIcon, villagerSheet } from "./sheets";

export const KINDS: readonly CropKind[] = ["turnip", "carrot", "pumpkin"];

export interface Pack {
  readonly coins: number;
  readonly crops: { readonly [K in CropKind]: number };
}

export interface Hud {
  clock(hour: number, day: number): void;
  pack(pack: Pack): void;
  seed(kind: CropKind): void;
  /** What the action key would do, or nothing to hide the hint. */
  prompt(text: string | undefined): void;
  /** A line of narration that fades on its own. */
  toast(text: string): void;
  /** Open a conversation. The lines show one at a time, and `advance` moves on. */
  say(name: string, look: Look, lines: readonly string[]): void;
  talking(): boolean;
  /** Finish typing the line, show the next, or close after the last. */
  advance(): void;
  show(visible: boolean): void;
}

export interface HudActions {
  pickSeed(kind: CropKind): void;
  openWardrobe(): void;
}

const hourText = (hour: number): string => {
  const whole = Math.floor(hour);
  const minutes = Math.floor(((hour - whole) * 60) / 10) * 10;

  return `${((whole + 11) % 12) + 1}:${String(minutes).padStart(2, "0")} ${whole < 12 ? "am" : "pm"}`;
};

const icon = (kind: CropKind): SVGSVGElement =>
  frameOf(createSprite(cropIcon(kind)).node, "-24 -24 48 48");

export const createHud = (host: HTMLElement, actions: HudActions): Hud => {
  const time = el("span", "");
  const sky = el("span", "sky");
  const coins = el("span", "");
  const counts = new Map(KINDS.map((kind) => [kind, el("span", "")] as const));
  const slots = new Map<CropKind, HTMLButtonElement>();
  const hint = el("div", "prompt");
  const hintText = el("span", "");
  const toast = el("div", "toast");
  const face = el("div", "face");
  const who = el("div", "who");
  const line = el("p", "");
  const more = el("span", "more", "E");
  const dialog = el("div", "dialog", face, el("div", "words", who, line), more);
  const wardrobe = el("button", "chip button", "Wardrobe");
  let lines: readonly string[] = [];
  let typed = 0;
  let typing = 0;
  let fading = 0;

  wardrobe.addEventListener("click", actions.openWardrobe);

  const hotbar = el("div", "hotbar");

  for (const [index, kind] of KINDS.entries()) {
    const slot = el(
      "button",
      "slot",
      el("kbd", "", String(index + 1)),
      icon(kind),
      el("span", "name", `${CROPS[kind].name} seeds`),
    );

    slot.addEventListener("click", () => actions.pickSeed(kind));
    slots.set(kind, slot);
    hotbar.append(slot);
  }

  hint.append(el("kbd", "", "E"), hintText);

  const root = el(
    "div",
    "hud",
    el(
      "div",
      "top",
      el("div", "chip", sky, time),
      wardrobe,
      el("div", "spacer"),
      el(
        "div",
        "chip pack",
        ...KINDS.flatMap((kind) => [icon(kind), counts.get(kind) ?? ""]),
        el("span", "coin"),
        coins,
      ),
    ),
    toast,
    hint,
    hotbar,
    dialog,
  );

  host.append(root);

  const type = (): void => {
    const text = lines[0] ?? "";

    typed = Math.min(text.length, typed + 2);
    line.textContent = text.slice(0, typed);

    if (typed >= text.length) clearInterval(typing);
  };

  const open = (): void => {
    typed = 0;
    clearInterval(typing);
    typing = window.setInterval(type, 24);
    type();
  };

  return {
    clock(hour, day) {
      const night = hour < 5.5 || hour >= 20.5;

      time.textContent = `Day ${day} · ${hourText(hour)}`;
      sky.classList.toggle("night", night);
    },
    pack(pack) {
      coins.textContent = String(pack.coins);

      for (const kind of KINDS) {
        const count = counts.get(kind);

        if (count) count.textContent = String(pack.crops[kind]);
      }
    },
    seed(kind) {
      for (const [of, slot] of slots) slot.classList.toggle("picked", of === kind);
    },
    prompt(text) {
      hint.classList.toggle("shown", text !== undefined);

      if (text !== undefined) hintText.textContent = text;
    },
    toast(text) {
      toast.textContent = text;
      toast.classList.add("shown");
      clearTimeout(fading);
      fading = window.setTimeout(() => toast.classList.remove("shown"), 2600);
    },
    say(name, look, said) {
      const portrait = createSprite(villagerSheet(look));

      portrait.show("idle-down");
      face.replaceChildren(frameOf(portrait.node, "-22 -72 44 44"));
      who.textContent = name;
      lines = said;
      dialog.classList.add("shown");
      open();
    },
    talking: () => lines.length > 0,
    advance() {
      const text = lines[0] ?? "";

      if (typed < text.length) {
        typed = text.length;
        type();

        return;
      }

      lines = lines.slice(1);

      if (lines.length > 0) open();
      else dialog.classList.remove("shown");
    },
    show(visible) {
      root.classList.toggle("hidden", !visible);
    },
  };
};
