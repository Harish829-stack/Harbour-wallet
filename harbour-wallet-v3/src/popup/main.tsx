import React from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from './ErrorBoundary';
import { logError } from '../core/logger';
import { installHarbourFetch } from '../core/harbour/fetchHook';
installHarbourFetch(); // gateway calls (market data, swap quotes, history) made from the popup are signed with the device key
window.addEventListener('error', (e) => logError('window error', e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => logError('unhandled rejection', e.reason));
// A toolbar popup sizes itself to its content, so a fluid layout collapses to a sliver. Give the popup (not the side panel or a tab,
// which the browser sizes) a fixed Chrome-legal size. getViews() is synchronous, so this applies before first paint.
try{
  const isPopup=(globalThis as any).chrome?.extension?.getViews?.({type:'popup'})?.includes(window);
  if(isPopup){const st=document.createElement('style');st.textContent='html,body{width:380px;height:600px;overflow:hidden}#root{height:600px;overflow-y:auto}.hb-root{min-height:600px}';document.head.appendChild(st);}
}catch{/* not an extension page */}
const root=createRoot(document.getElementById('root')!);
// Vite eliminates this branch and its fixture module from production builds.
if(import.meta.env.DEV && new URLSearchParams(location.search).has('design-preview')){
  void import('./design/Preview').then(({Preview})=>root.render(<Preview/>));
}else{
  // Load persisted settings first so the first paint already has the right theme and currency.
  void import('./settingsStore').then(({initSettingsFromStorage})=>initSettingsFromStorage()).catch(()=>{})
    .then(()=>import('./App')).then(({App})=>root.render(<ErrorBoundary><App/></ErrorBoundary>));
}
