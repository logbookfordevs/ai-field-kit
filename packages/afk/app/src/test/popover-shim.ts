// happy-dom has no Popover API; this mirrors the parts the app relies on (open state, toggle events, popovertarget invokers, Escape light dismiss).
export function installPopoverShim(): void {
  const proto = HTMLElement.prototype as HTMLElement & { __popoverShim?: true };
  if (typeof proto.showPopover === "function") return;
  const open = new WeakSet<HTMLElement>();
  const toggle = (element: HTMLElement, next: boolean): void => {
    if (open.has(element) === next) return;
    if (next) open.add(element); else open.delete(element);
    element.dispatchEvent(Object.assign(new Event("toggle"), { oldState: next ? "closed" : "open", newState: next ? "open" : "closed" }));
  };
  proto.showPopover = function showPopover(this: HTMLElement) { toggle(this, true); };
  proto.hidePopover = function hidePopover(this: HTMLElement) { toggle(this, false); };
  proto.togglePopover = function togglePopover(this: HTMLElement) { toggle(this, !open.has(this)); return open.has(this); };
  const matches = Element.prototype.matches;
  Element.prototype.matches = function patchedMatches(this: Element, selector: string) {
    if (selector === ":popover-open") return this instanceof HTMLElement && open.has(this);
    return matches.call(this, selector);
  } as Element["matches"];
  document.addEventListener("click", event => {
    const invoker = event.target instanceof Element ? event.target.closest<HTMLElement>("[popovertarget]") : null;
    const target = invoker ? document.getElementById(invoker.getAttribute("popovertarget") ?? "") : null;
    if (target) toggle(target, !open.has(target));
  });
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    for (const element of document.querySelectorAll<HTMLElement>("[popover]")) if (open.has(element)) toggle(element, false);
  });
}
