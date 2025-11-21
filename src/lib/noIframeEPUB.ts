// Forces epub.js to render inline (no iframe)
import ePub from "epubjs";

// Patch rendition to disable iframe usage
(function patchNoIframe() {
  const RenditionProto = (ePub as any).Rendition?.prototype;
  if (!RenditionProto) return;

  // Replace default renderTo with inline injection of section HTML
  const originalRenderTo = RenditionProto.renderTo;

  RenditionProto.renderTo = function(element: HTMLElement, options: any = {}) {
    // Force inline (div-based) rendering
    options.flow = "scrolled-doc";
    options.manager = "continuous";

    // Disable iframe creation
    this.manager && (this.manager.views = []);
    this.iframes = [];

    // Call the original with modified options
    return originalRenderTo.call(this, element, options);
  };
})();
