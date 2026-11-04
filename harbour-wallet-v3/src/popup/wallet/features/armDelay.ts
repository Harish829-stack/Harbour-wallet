// Approval arming delay (PT-09). A site can open a request window under the user's cursor and time it with a double-click on its own
// page, so the second click lands on Approve. Like the security delay browsers put on install / permission prompts
// (Firefox `security.dialog_enable_delay`), the approve button only arms once the window has been visible AND focused for `ms`.
// It disarms on blur/hidden and re-arms when the shown request changes. Reject is never delayed.
import { useEffect, useState } from 'react';

export const ARM_DELAY_MS = 800;
export function useArmed(key: unknown, ms = ARM_DELAY_MS): boolean {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const disarm = () => { if (t) clearTimeout(t); t = undefined; setArmed(false); };
    const arm = () => {
      disarm();
      if (document.visibilityState === 'visible' && document.hasFocus()) t = setTimeout(() => setArmed(true), ms);
    };
    arm();
    const onVis = () => (document.visibilityState === 'visible' ? arm() : disarm());
    window.addEventListener('focus', arm); window.addEventListener('blur', disarm); document.addEventListener('visibilitychange', onVis);
    return () => { disarm(); window.removeEventListener('focus', arm); window.removeEventListener('blur', disarm); document.removeEventListener('visibilitychange', onVis); };
  }, [key, ms]);
  return armed;
}
