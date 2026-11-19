import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SidePanelApp } from '@/sidepanel/SidePanelApp';
import '@/shared/styles/global.css';

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <SidePanelApp />
    </StrictMode>
  );
}
