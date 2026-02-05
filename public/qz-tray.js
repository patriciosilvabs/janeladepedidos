/**
 * QZ Tray - Browser Print Plugin
 * https://qz.io
 * 
 * This is a minimal stub that loads the QZ Tray library from the official CDN.
 * The actual library is loaded dynamically to ensure we always get the latest version.
 */

(function() {
  'use strict';
  
  // Check if QZ is already loaded
  if (typeof window.qz !== 'undefined') {
    console.log('[QZ Tray] Already loaded');
    return;
  }

  // Create script element to load from CDN
  var script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.min.js';
  script.async = true;
  script.onload = function() {
    console.log('[QZ Tray] Library loaded from CDN');
    
    // Dispatch custom event to notify that QZ is ready
    window.dispatchEvent(new CustomEvent('qz-ready'));
  };
  script.onerror = function() {
    console.warn('[QZ Tray] Failed to load from CDN. Install QZ Tray locally: https://qz.io/download/');
  };
  
  // Append to head
  document.head.appendChild(script);
})();
