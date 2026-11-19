import { film } from "@svjeez/dom";
import { serve } from "@svjeez/dom/vite";
import { selectors } from "playwright-core";

// The app names its parts for svjeez with data-part; let getByTestId find them too.
selectors.setTestIdAttribute("data-part");

export default await film(
  serve({ selector: "#root" }),
  async ({ page, snap }) => {
    const part = (name: string) => page.getByTestId(name);
    const rest = () => page.mouse.move(680, 410);

    await rest();
    await snap("idle", { hold: 1.2 });

    await page.keyboard.press("ControlOrMeta+k");
    await snap("palette", { over: 0.35 });
    await part("query").fill("new");
    await snap("query", { over: 0.45 });
    await part("query").fill("new iss");
    await snap("narrowed", { over: 0.4, hold: 0.4 });

    await part("cmd-new-issue").click();
    await snap("dialog", { over: 0.3 });
    await part("title").fill("Save drafts offline");
    await snap("titled", { over: 1.1, hold: 0.3 });

    await part("label-feature").click();
    await snap("labelled", { over: 0.2, hold: 0.35 });
    await part("who-mara").click();
    await snap("assigned", { over: 0.2, hold: 0.4 });
    await part("create").click();
    await snap("created", { over: 0.6, hold: 0.9 });

    // Drag the new card from Todo to In progress.
    await part("card-ENG-143").hover();
    await page.mouse.down();
    await part("lane-progress").hover({ force: true });
    await snap("carried", { over: 0.6 });
    await page.mouse.up();
    await snap("dropped", { over: 0.2, hold: 0.6 });

    await part("status-ENG-143").click();
    await snap("menu", { over: 0.25, hold: 0.4 });
    await part("set-done").click();
    await snap("done", { over: 0.7, hold: 2.8 });

    // Back to the first frame, so the loop is seamless.
    await page.reload();
    await part("board").waitFor();
    await rest();
    await snap("again", { over: 0.9, hold: 0.4 });
  },
  {
    scheme: "both",
    cursor: true,
    title: "A project board, filmed from its React app",
    viewport: { width: 800, height: 450 },
    cache: "states.json",
  },
);
