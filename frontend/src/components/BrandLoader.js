import React, { useEffect, useMemo, useState } from 'react';

const getConnectionMessage = (timedOut) => {
  return timedOut ? 'Still loading. Pulling everything into place.' : 'Loading the next drop...';
};

const BrandLoader = ({
  fullScreen = false,
  minHeight = '50vh',
  title = 'LAST GEAR',
  eyebrow = 'Loading',
}) => {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setTimedOut(true), 3200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  const message = useMemo(() => getConnectionMessage(timedOut), [timedOut]);

  return (
    <div
      className={`overflow-hidden bg-[#f3efe7] text-[#16120d] ${fullScreen ? 'min-h-screen' : ''}`}
      style={{ minHeight: fullScreen ? undefined : minHeight }}
    >
      <div className="relative flex h-full min-h-inherit items-center justify-center px-4 py-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(217,145,70,0.18),transparent_26%),linear-gradient(180deg,#f7f3ec_0%,#f0ebe2_50%,#ece7de_100%)]" />
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage:
            'linear-gradient(rgba(18,14,11,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(18,14,11,0.7) 1px, transparent 1px)',
          backgroundSize: '46px 46px',
        }} />

        <div className="relative z-10 flex w-full max-w-md flex-col items-center text-center">
          <div className="mb-5 inline-flex items-center gap-3 rounded-full border border-black/10 bg-white/60 px-4 py-2 font-nav text-[11px] text-black/55 shadow-sm backdrop-blur">
            <span>{eyebrow}</span>
            <span className="h-1 w-1 rounded-full bg-[#d99146]" />
            <span>Fashion Division</span>
          </div>

          <div className="mb-6 flex items-center gap-4">
            <img src="/logo-black.png" alt="LAST GEAR logo" className="h-10 w-auto object-contain loader-bolt-float" />
            <div className="text-left">
              <p className="font-nav text-[2rem] leading-none tracking-[0.16em] text-[#120e0b]">{title}</p>
              <p className="mt-1 font-nav text-[10px] uppercase tracking-[0.38em] text-black/38">Moving Into Place</p>
            </div>
          </div>

          <div className="mb-5 flex items-end gap-2">
            <span className="loader-bar h-5 w-2 rounded-full bg-[#120e0b]" style={{ animationDelay: '0s' }} />
            <span className="loader-bar h-9 w-2 rounded-full bg-[#d99146]" style={{ animationDelay: '0.14s' }} />
            <span className="loader-bar h-12 w-2 rounded-full bg-[#120e0b]" style={{ animationDelay: '0.28s' }} />
            <span className="loader-bar h-8 w-2 rounded-full bg-[#d99146]" style={{ animationDelay: '0.42s' }} />
          </div>

          <p className="font-nav text-base text-black/72">{message}</p>
          <p className="mt-2 max-w-xs text-sm leading-6 text-black/44">
            Just a moment.
          </p>
        </div>
      </div>
    </div>
  );
};

export default BrandLoader;
