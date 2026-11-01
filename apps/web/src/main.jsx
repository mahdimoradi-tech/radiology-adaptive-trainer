import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/vazirmatn';
import './index.css';

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <div className="p-4">
        <h1>آموزش تطبیقی رادیولوژی</h1>
      </div>
    </StrictMode>,
  );
}
