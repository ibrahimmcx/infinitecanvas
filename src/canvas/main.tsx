import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SpatialApp } from '@/spatial/SpatialApp';
import '@/shared/styles/global.css';

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <SpatialApp />
    </StrictMode>
  );
}
