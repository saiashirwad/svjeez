/**
 * The React `key` of the element, read from the fiber React attaches to its DOM nodes (`__reactFiber$…`), or undefined.
 * A key on a component counts when that component renders just this element. Self-contained (no imports, nothing outside
 * the function), so `reactIdentifyScript` can be its own source: it also runs in app pages that are not mounted by `component()`.
 */
export const reactIdentify = (el: Element): string | undefined => {
  interface Fiber {
    key: string | null;
    tag: number;
    child: Fiber | null;
    sibling: Fiber | null;
    return: Fiber | null;
  }

  const prop = Object.keys(el).find((name) => name.startsWith("__reactFiber$"));
  // SAFETY: React stores the fiber of a DOM node under this property.
  const stored: Record<string, Fiber | undefined> = Object(el);
  let fiber = prop ? (stored[prop] ?? null) : null;

  // HostRoot, HostPortal, HostComponent, HostHoistable, HostSingleton: a key above one of these names another element.
  const hosts = [3, 4, 5, 26, 27];

  while (fiber) {
    if (fiber.key !== null) return fiber.key;

    const above: Fiber | null = fiber.return;

    if (!above || hosts.includes(above.tag) || above.child !== fiber || fiber.sibling) return;

    fiber = above;
  }

  return undefined;
};

export const reactIdentifyScript = `(${reactIdentify.toString()})`;
