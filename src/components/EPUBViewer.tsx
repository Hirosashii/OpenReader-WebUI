'use client';

import { useEffect, useRef, useCallback } from 'react';
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
  const { isResizing, setIsResizing, dimensions } = useEPUBResize(containerRef);

  const checkResize = useCallback(() => {
    if (isResizing && dimensions && bookRef.current?.isOpen && renditionRef.current) {
      pause();
      // Only extract text when we have dimensions, ensuring the resize is complete
      extractPageText(bookRef.current, renditionRef.current, true);
      setIsResizing(false);
      
      return true;
    } else {
      return false;
    }
  }, [isResizing, setIsResizing, dimensions, pause, bookRef, renditionRef, extractPageText]);

  // Check for isResizing to pause TTS and re-extract text
  useEffect(() => {
    if (checkResize()) return;
  }, [checkResize]);

  // Register the location change handler
  useEffect(() => {
    registerLocationChangeHandler(handleLocationChanged);
  }, [registerLocationChangeHandler, handleLocationChanged]);

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
            // ---- FORCE NO-IFRAME EPUB RENDERING ----
            try {
              // Disable iframe-based manager
              if (_rendition.book?.settings) {
                _rendition.book.settings.manager = "continuous";
                _rendition.book.settings.flow = "scrolled-doc";
                _rendition.book.settings.layout = "reflowable";
              }
          
              if (_rendition.settings) {
                _rendition.settings.manager = "continuous";
                _rendition.settings.flow = "scrolled-doc";
                _rendition.settings.layout = "reflowable";
              }
          
              // Nullify iframe creation
              _rendition.iframes = [];
              _rendition.render = _rendition.inject;
            } catch (e) {
              console.error("Failed to override iframe mode:", e);
            }
          
            setRendition(_rendition);
            updateTheme();
          }}
        />
      </div>
    </div>
  );
}
