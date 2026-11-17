import { createSprite, framed, type Paint } from "@svjeez/play";
import { CROPS, type CropKind } from "../art/crops";
import { KINDS, type Hud, type Msg } from "./rules";
import { cropIcon, villagerSheet } from "./sheets";
import { el, openWardrobe } from "./wardrobe";

const hourText = (hour: number): string => {
  const whole = Math.floor(hour);
  const minutes = Math.floor(((hour - whole) * 60) / 10) * 10;

  return `${((whole + 11) % 12) + 1}:${String(minutes).padStart(2, "0")} ${whole < 12 ? "am" : "pm"}`;
};

const icon = (kind: CropKind): SVGSVGElement =>
  framed(createSprite(cropIcon(kind)), { x: -24, y: -24, width: 48, height: 48 });

/** Call `change` with a value only when it differs from the last one given. */
const onChange = <Value>(change: (value: Value) => void): ((value: Value) => void) => {
  let last: { readonly value: Value } | undefined;

  return (value) => {
    if (last && last.value === value) return;
    last = { value };
    change(value);
  };
};

/**
 * The page around the world: the clock, the pack, the seeds, hints, talk and the wardrobe. It is built once, and what
 * it returns paints a frame's hud, touching only the parts whose data changed.
 */
export const createHud = (host: HTMLElement, send: (msg: Msg) => void): Paint<Hud> => {
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
  const dialog = el("div", "dialog", face, el("div", "words", who, line), el("span", "more"));
  const wardrobe = el("button", "chip button", "Wardrobe");
  const hotbar = el("div", "hotbar");
  let typed = 0;
  let typing = 0;
  let panel: HTMLElement | undefined;

  wardrobe.addEventListener("click", () => send({ type: "wardrobe" }));

  for (const [index, kind] of KINDS.entries()) {
    const slot = el(
      "button",
      "slot",
      el("kbd", "", String(index + 1)),
      icon(kind),
      el("span", "name", `${CROPS[kind].name} seeds`),
    );

    slot.addEventListener("click", () => send({ type: "seed", kind }));
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

  const clock = onChange((text: string) => {
    time.textContent = text;
  });

  const night = onChange((dark: boolean) => sky.classList.toggle("night", dark));

  const pack = onChange((held: Hud["pack"]) => {
    coins.textContent = String(held.coins);

    for (const kind of KINDS) {
      const count = counts.get(kind);

      if (count) count.textContent = String(held.crops[kind]);
    }
  });

  const seed = onChange((picked: CropKind) => {
    for (const [kind, slot] of slots) slot.classList.toggle("picked", kind === picked);
  });

  const prompt = onChange((text: string | undefined) => {
    hint.classList.toggle("shown", text !== undefined);

    if (text !== undefined) hintText.textContent = text;
  });

  const told = onChange((text: string | undefined) => {
    toast.classList.toggle("shown", text !== undefined);

    if (text !== undefined) toast.textContent = text;
  });

  const speaker = onChange((name: string | undefined) => {
    dialog.classList.toggle("shown", name !== undefined);

    if (name !== undefined) who.textContent = name;
  });

  const portrait = onChange((look: string | undefined) => {
    if (look === undefined) return;
    const sprite = createSprite(villagerSheet(JSON.parse(look)));

    sprite.show("idle-down");
    face.replaceChildren(framed(sprite, { x: -27, y: -96, width: 54, height: 54 }));
  });

  const speech = onChange((text: string | undefined) => {
    clearInterval(typing);
    typed = 0;

    if (text === undefined) return;

    const type = (): void => {
      typed = Math.min(text.length, typed + 2);
      line.textContent = text.slice(0, typed);

      if (typed >= text.length) clearInterval(typing);
    };

    typing = window.setInterval(type, 24);
    type();
  });

  const dressing = onChange((open: boolean) => root.classList.toggle("hidden", open));

  return (hud) => {
    clock(`Day ${hud.day} · ${hourText(hud.hour)}`);
    night(hud.hour < 5.5 || hud.hour >= 20.5);
    pack(hud.pack);
    seed(hud.seed);
    prompt(hud.prompt);
    told(hud.toast);
    speaker(hud.talk?.name);
    portrait(hud.talk && JSON.stringify(hud.talk.look));
    speech(hud.talk?.text);
    dressing(hud.wardrobe !== undefined);

    if (hud.wardrobe && !panel)
      panel = openWardrobe(host, hud.wardrobe.villager, hud.wardrobe.first, (villager) =>
        send({ type: "dress", villager }),
      );

    if (!hud.wardrobe && panel) {
      panel.remove();
      panel = undefined;
    }
  };
};
