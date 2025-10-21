export function isVisible(element: Element): boolean {
  if (!(element instanceof Element)) {
    return false;
  }
  const htmlElement = element as HTMLElement;
  return !!(htmlElement.offsetWidth || htmlElement.offsetHeight || htmlElement.getClientRects().length);
}

export function createTreeWalker(
  root: Node,
  whatToShow: number,
  filter?: NodeFilter
): TreeWalker {
  return document.createTreeWalker(root, whatToShow, filter ?? null);
}
