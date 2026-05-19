import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Self-hosted fonts via @fontsource — no CDN dependency after deploy
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/700.css';
import '@fontsource/lato/400.css';
import '@fontsource/lato/700.css';
import '@fontsource/montserrat/400.css';
import '@fontsource/montserrat/700.css';
import '@fontsource/montserrat/900.css';
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/700.css';
import '@fontsource/raleway/400.css';
import '@fontsource/raleway/700.css';
import '@fontsource/raleway/900.css';
import '@fontsource/oswald/400.css';
import '@fontsource/oswald/700.css';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/700.css';
import '@fontsource/ubuntu/400.css';
import '@fontsource/ubuntu/700.css';
import '@fontsource/playfair-display/400.css';
import '@fontsource/playfair-display/700.css';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/700.css';
import '@fontsource/cinzel/400.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/bebas-neue/400.css';
import '@fontsource/pacifico/400.css';
import '@fontsource/dancing-script/400.css';
import '@fontsource/dancing-script/700.css';
import '@fontsource/source-code-pro/400.css';
import '@fontsource/source-code-pro/700.css';

// Inject @font-face for custom fonts (not on @fontsource)
// Must use import.meta.env.BASE_URL so paths work under /iwms in production
{
  const b = (import.meta.env.BASE_URL ?? '/').replace(/\/?$/, '/');
  const s = document.createElement('style');
  s.textContent = [
    `@font-face{font-family:'UTM AVO';src:url('${b}fonts/UTMAvo-400.ttf')format('truetype');font-weight:400;font-display:swap}`,
    `@font-face{font-family:'UTM AVO';src:url('${b}fonts/UTMAvo-700.ttf')format('truetype');font-weight:700 900;font-display:swap}`,
    `@font-face{font-family:'Arkhip';src:url('${b}fonts/Arkhip-400.ttf')format('truetype');font-weight:400;font-display:swap}`,
    `@font-face{font-family:'Arkhip';src:url('${b}fonts/Arkhip-700.ttf')format('truetype');font-weight:700 900;font-display:swap}`,
  ].join('');
  document.head.appendChild(s);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
