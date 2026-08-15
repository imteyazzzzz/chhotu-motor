import React from 'react';
import { createRoot } from 'react-dom/client';
import { Agentation } from 'agentation';

// Check if running in a local environment (development)
const isLocal = 
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1' || 
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

  const root = createRoot(container);
  root.render(
    React.createElement(Agentation, {
      endpoint: "http://localhost:4747",
      onSessionCreated: (sessionId) => {
        console.log("Agentation session started:", sessionId);
      }
    })
  );
}
