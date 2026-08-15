import React from 'react';
import { createRoot } from 'react-dom/client';
import { Agentation } from 'agentation';

// Check if running in a local/development environment (localhost, 127.0.0.1, private IPs, or file://)
const isLocal = 
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1' || 
  window.location.hostname.startsWith('172.') || 
  window.location.hostname.startsWith('192.168.') || 
  window.location.hostname.startsWith('10.') || 
  window.location.protocol === 'file:';

if (isLocal) {
  // Ensure the DOM is fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAgentation);
  } else {
    initAgentation();
  }
}

function copyToClipboardFallback(text) {
  // Try modern Clipboard API first if it is a secure context
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text)
      .then(() => console.log('Copied to clipboard (secure context)'))
      .catch((err) => {
        console.warn('navigator.clipboard failed, trying fallback copy...', err);
        fallbackCopyToClipboard(text);
      });
  } else {
    fallbackCopyToClipboard(text);
  }
}

function fallbackCopyToClipboard(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  // Ensure the textarea is off-screen and invisible
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '0';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    const successful = document.execCommand('copy');
    if (successful) {
      console.log('Copied to clipboard (fallback copy)');
    } else {
      console.error('Fallback copy execution failed');
    }
  } catch (err) {
    console.error('Fallback copy failed', err);
  }
  document.body.removeChild(textarea);
}

function initAgentation() {
  // Prevent duplicate insertion
  if (document.getElementById('agentation-root')) return;

  const container = document.createElement('div');
  container.id = 'agentation-root';
  document.body.appendChild(container);

  // Use the current host IP for connection, falling back to localhost for file:// protocol
  const host = window.location.hostname || 'localhost';
  const endpoint = `http://${host}:4747`;

  const root = createRoot(container);
  root.render(
    React.createElement(Agentation, {
      endpoint: endpoint,
      copyToClipboard: false, // Turn off default copy to run our fallback onCopy handler
      onCopy: (markdown) => {
        copyToClipboardFallback(markdown);
      },
      onSessionCreated: (sessionId) => {
        console.log("Agentation session started:", sessionId);
      }
    })
  );
}
