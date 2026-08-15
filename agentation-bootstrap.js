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
      onSessionCreated: (sessionId) => {
        console.log("Agentation session started:", sessionId);
      }
    })
  );
}
