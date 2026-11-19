import { film } from "@svjeez/dom";
import { serve } from "@svjeez/dom/vite";

const part = (name: string) => `[data-part="${name}"]`;

export default await film(
  serve({ root: import.meta.dirname, selector: "#root" }),
  async ({ page, snap }) => {
    // A pointer drawn inside the page, so each snap records where it is.
    const arrive = async () => {
      await page.evaluate(() => {
        document.querySelector(".app")?.insertAdjacentHTML(
          "beforeend",
          `<svg class="cursor" width="14" height="22" viewBox="0 0 14 22" style="transform: translate(680px, 410px)">
             <path d="M0 0V17.6l4.6-4.2 3.3 7.5 3.1-1.3-3.3-7.3H13.2Z" /></svg>`,
        );
      });
    };

    const place = (x: number, y: number) =>
      page.evaluate(
        ([x, y]) => {
          const cursor = document.querySelector<SVGElement>(".cursor");

          if (cursor) cursor.style.transform = `translate(${x}px, ${y}px)`;
        },
        [x, y],
      );

    const box = async (name: string) => {
      const found = await page.locator(part(name)).boundingBox();

      if (!found) throw new Error(`No "${name}" on the page.`);

      return found;
    };

    const point = async (name: string, dx = 0.5, dy = 0.5) => {
      const { x, y, width, height } = await box(name);

      await place(x + width * dx, y + height * dy);
      await page.mouse.move(x + width * dx, y + height * dy);
    };

    const click = async (name: string, dx = 0.5, dy = 0.5) => {
      await point(name, dx, dy);
      await page.mouse.down();
      await page.mouse.up();
    };

    await arrive();
    await snap("idle", { hold: 1.2 });

    await page.keyboard.press("ControlOrMeta+k");
    await snap("palette", { over: 0.35 });
    await page.locator(part("query")).fill("new");
    await snap("query", { over: 0.45 });
    await page.locator(part("query")).fill("new iss");
    await snap("narrowed", { over: 0.4, hold: 0.4 });

    await click("cmd-new-issue", 0.3);
    await arrive();
    await snap("dialog", { over: 0.3 });
    await page.locator(part("title")).fill("Save drafts offline");
    await snap("titled", { over: 1.1, hold: 0.3 });

    await click("label-feature");
    await snap("labelled", { over: 0.2, hold: 0.35 });
    await click("who-mara");
    await snap("assigned", { over: 0.2, hold: 0.4 });
    await click("create");
    await snap("created", { over: 0.6, hold: 0.9 });

    // Drag the new card from Todo to In progress.
    await point("card-ENG-143", 0.55, 0.35);
    await page.mouse.down();
    const lane = await box("lane-progress");
    const [x, y] = [lane.x + lane.width * 0.5, lane.y + lane.height * 0.2];

    await page.mouse.move(x, y, { steps: 6 });
    await place(x, y);
    await snap("carried", { over: 0.6 });
    await page.mouse.up();
    await snap("dropped", { over: 0.2, hold: 0.6 });

    await click("status-ENG-143");
    await snap("menu", { over: 0.25, hold: 0.4 });
    await click("set-done", 0.35);
    await snap("done", { over: 0.7, hold: 2.8 });

    // Back to the first frame, so the loop is seamless.
    await page.reload();
    await page.waitForSelector(".app");
    await arrive();
    await snap("again", { over: 0.9, hold: 0.4 });
  },
  {
    scheme: "both",
    title: "A project board, filmed from its React app",
    viewport: { width: 800, height: 450 },
    cache: "states.json",
  },
);
