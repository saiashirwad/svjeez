/**
 * The identity of the element from React: its `key`, scoped by the list it is in, or undefined. The fiber is read from the property
 * React attaches to its DOM nodes (`__reactFiber$…`). A key on a component counts when that component renders just this element.
 * React keys are per list, so `key=1` in two lists is two things: the key is prefixed with its parent element's identity (that
 * parent's own scoped key when it has one, else its tag and position, up to the nearest keyed ancestor). A keyed item that moves
 * to another list is therefore a new one; give it a `data-key` to follow it. Self-contained (no imports, nothing outside the
 * function), so `record` can ship it as its own source (`.toString()`): it runs in app pages that are not mounted by `component()` too.
 */
export const reactIdentify = (el: Element): string | undefined => {
  interface Fiber {
    key: string | null;
    tag: number;
    type: unknown;
    index: number;
    stateNode: unknown;
    child: Fiber | null;
    sibling: Fiber | null;
    return: Fiber | null;
  }

  // HostRoot, HostPortal, HostComponent, HostHoistable, HostSingleton: a key above one of these names another element.
  const hosts = [3, 4, 5, 26, 27];

  const fiberOf = (node: Element): Fiber | null => {
    const prop = Object.keys(node).find((name) => name.startsWith("__reactFiber$"));
    // SAFETY: React stores the fiber of a DOM node under this property.
    const stored: Record<string, Fiber | undefined> = Object(node);

    return prop ? (stored[prop] ?? null) : null;
  };

  /** Where the children of the host fiber `host` are: its own identity, or else its tag and position under whatever scopes it. */
  const scopeOf = (host: Fiber | null): string => {
    if (!host || host.tag !== 5) return "";

    const own = host.stateNode instanceof Element ? identify(host.stateNode) : undefined;

    if (own !== undefined) return own;

    return `${scopeOf(hostAbove(host))}|${String(host.type)}${host.index}`;
  };

  const hostAbove = (fiber: Fiber): Fiber | null => {
    let above = fiber.return;

    while (above && !hosts.includes(above.tag)) above = above.return;

    return above;
  };

  const identify = (node: Element): string | undefined => {
    let fiber = fiberOf(node);

    while (fiber) {
      if (fiber.key !== null) return `${scopeOf(hostAbove(fiber))}|${fiber.key}`;

      const above: Fiber | null = fiber.return;

      if (!above || hosts.includes(above.tag) || above.child !== fiber || fiber.sibling) return;

      fiber = above;
    }

    return undefined;
  };

  return identify(el);
};
