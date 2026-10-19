import { useEffect, useRef } from 'react';
import lottie from 'lottie-web/build/player/lottie_light';

export function Animation({ name, className = '' }: { name: string; className?: string }) {
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!element.current) return;
    const animation = lottie.loadAnimation({ container: element.current, renderer: 'svg',
      loop: name !== 'confetti', autoplay: true, path: `/reference/${name}.json` });
    return () => animation.destroy();
  }, [name]);
  return <div ref={element} className={className} aria-hidden="true" />;
}
