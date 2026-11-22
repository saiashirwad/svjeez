import { SceneError } from "../model/scene-error";

/** The ids of the components being built, outermost first: what an `id` or a `ref("id")` written inside is scoped by. */
const open: string[] = [];

export const scopeNow = (): readonly string[] => [...open];

export const checkedId = (id: string, what: string): string => {
  if (id === "" || id.split("/").some((step) => step === ""))
    throw new SceneError(
      `${what} needs an id of one or more characters, joined by "/" only to reach a node inside another, got "${id}".`,
    );

  return id;
};

/** The id a node written inside the open components has: `card1/note` for id="note" inside <NoteCard id="card1">. */
export const scoped = (id: string): string => {
  if (id === "" || id.includes("/"))
    throw new SceneError(
      `An id is one word, got "${id}": a "/" joins the ids of the components it is inside, so it can't be written in one.`,
      'Give the node an id such as id="note", and read it as ref("card1/note") from outside card1.',
    );

  return [...open, id].join("/");
};

export const within = <T>(id: string, build: () => T): T => {
  open.push(id);

  try {
    return build();
  } finally {
    open.pop();
  }
};
