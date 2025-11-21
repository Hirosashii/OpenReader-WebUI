// Patch epub.js to disable iframe-based rendering and force inline DOM rendering.
import ePub from "epubjs";

// Define minimal shape for the EPUB Rendition prototype.
// We avoid using "any" to comply with ESLint rules.
interface PatchedRendition {
  renderTo: (element: HTMLElement, options?: Record<string, unknown>) => unknown;
  manager?: { views: unknown[] };
  iframes?: unknown[];
  [key: string]: unknown;
}

(function patchNoIframe() {
  // Extract prototype safely using an explicit cast.
  const RawRendition = (ePub as unknown as { Rendition?: { prototype?: PatchedRendition } }).Rendition;

  if (!RawRendition || !RawRendition.prototype) {
    return;
  }

  const proto = RawRendition.prototype as PatchedRendition;

  const originalRenderTo = proto.renderTo.bind(proto);

  proto.renderTo = function (
    element: HTMLElement,
    options: Record<string, unknown> = {}
  ) {
    // Force inline flow instead of iframe-based pagination
    options.manager = "continuous";
    options.flow = "scrolled-doc";

    // Remove iframe usage
    if (this.manager) {
      this.manager.views = [];
    }

    this.iframes = [];

    // Call original epub.js render
    return originalRenderTo(element, options);
  };
})();
