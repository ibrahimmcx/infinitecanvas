import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PopupApp } from '@/popup/PopupApp';
import '@/shared/styles/global.css';

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <PopupApp />
    </StrictMode>
  );
}
