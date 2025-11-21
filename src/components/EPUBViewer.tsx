'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { useEPUB } from '@/contexts/EPUBContext';
import { useTTS } from '@/contexts/TTSContext';
import { useConfig } from '@/contexts/ConfigContext';
import { DocumentSkeleton } from '@/components/DocumentSkeleton';
import { useEPUBTheme, getThemeStyles } from '@/hooks/epub/useEPUBTheme';
import { useEPUBResize } from '@/hooks/epub/useEPUBResize';

const ReactReader = dynamic(() => import('react-reader').then(mod => mod.ReactReader), {
  ssr: false,
  loading: () => <DocumentSkeleton />
});

interface EPUBViewerProps {
  className?: string;
}

export function EPUBViewer({ className = '' }: EPUBViewerProps) {
  const { 
    currDocData, 
    currDocName, 
    currDocText,      // ⬅ added
    locationRef, 
    handleLocationChanged, 
    bookRef, 
    renditionRef, 
    tocRef, 
    setRendition,
    extractPageText 
  } = useEPUB();

  const { registerLocationChangeHandler, pause } = useTTS();
  const { epubTheme } = useConfig();
  const { updateTheme } = useEPUBTheme(epubTheme, renditionRef.current);

  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [overlayStyle, setOverlayStyle] = useState({});
  const { isResizing, setIsResizing, dimensions } = useEPUBResize(containerRef);

  // ---------------------------------------------------------
  // Dynamically mirror styling from the EPUB iframe
  // ---------------------------------------------------------
  const syncOverlay = useCallback(() => {
    const iframe: HTMLIFrameElement | null | undefined =
      containerRef.current?.querySelector("iframe");

    if (!iframe) return;
    const doc = iframe.contentDocument;
    if (!doc) return;

    const body = doc.body;
    const cs = window.getComputedStyle(body);

    setOverlayStyle({
      position: "absolute",
      left: 0,
      top: 0,
      width: "100%",
      height: "100%",
      overflow: "hidden",

      // MUST remain hoverable for Migaku
      pointerEvents: "auto",

      // Invisible but real text
      color: "transparent",

      // Real EPUB layout
      fontSize: cs.fontSize,
      lineHeight: cs.lineHeight,
      columnCount: cs.columnCount,
      columnGap: cs.columnGap,
      columnWidth: cs.columnWidth,
      padding: cs.padding,
      whiteSpace: "pre-wrap",

      zIndex: 9999
    });
  }, [containerRef]);

  // ---------------------------------------------------------
  // Resize → re-extract text after layout
  // ---------------------------------------------------------
  const checkResize = useCallback(() => {
    if (isResizing && dimensions && bookRef.current?.isOpen && renditionRef.current) {
      pause();
      extractPageText(bookRef.current, renditionRef.current, true);
      setIsResizing(false);
      return true;
    } else {
      return false;
    }
  }, [isResizing, setIsResizing, dimensions, pause, bookRef, renditionRef, extractPageText]);

  // ---------------------------------------------------------
  // Effects
  // ---------------------------------------------------------

  // Run syncOverlay after text/theme/size changes
  useEffect(() => {
    const id = setTimeout(syncOverlay, 120); // Small delay allows epub.js to finish layout
    return () => clearTimeout(id);
  }, [currDocText, epubTheme, dimensions, syncOverlay]);

  // Monitor resizing
  useEffect(() => {
    if (checkResize()) return;
  }, [checkResize]);

  // Register location-changed callback
  useEffect(() => {
    registerLocationChangeHandler(handleLocationChanged);
  }, [registerLocationChangeHandler, handleLocationChanged]);

  // ---------------------------------------------------------
  // Render
  // ---------------------------------------------------------

  if (!currDocData) {
    return <DocumentSkeleton />;
  }

  return (
    <div className={`h-full flex flex-col relative z-0 ${className}`} ref={containerRef}>
      <div className="flex-1">
        <ReactReader
          loadingView={<DocumentSkeleton />}
          key={'epub-reader'}
          location={locationRef.current}
          locationChanged={handleLocationChanged}
          url={currDocData}
          title={currDocName}
          tocChanged={(_toc) => (tocRef.current = _toc)}
          showToc={true}
          readerStyles={epubTheme && getThemeStyles() || undefined}
          getRendition={(_rendition) => {
            setRendition(_rendition);
            updateTheme();
            setTimeout(syncOverlay, 100);  // also sync after initial load
          }}
        />
      </div>

      {/* MIGAKU OVERLAY — invisible text matching EPUB columns */}
      {currDocText && (
        <div
          id="migaku-overlay"
          ref={overlayRef}
          style={overlayStyle}
        >
          {currDocText}
        </div>
      )}
    </div>
  );
}
