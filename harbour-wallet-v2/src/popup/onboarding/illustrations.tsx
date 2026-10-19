import React from 'react';

// Original illustrations for the "Start exploring" carousel (no third-party logos). Colours come from the onboarding CSS variables.
const B = 'var(--hb-brand, #14574a)', SOFT = 'color-mix(in srgb, var(--hb-brand, #14574a) 14%, white)', INK = 'var(--hb-ink, #16302b)', LINE = 'var(--hb-line, #d9dcd7)';
const Frame: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <svg viewBox="0 0 466 360" width="100%" height="100%" role="img" aria-label={label} preserveAspectRatio="xMidYMid slice" style={{ display: 'block' }}>{children}</svg>
);
const Coin: React.FC<{ x: number; y: number; r: number; fill?: string }> = ({ x, y, r, fill = B }) => (
  <g><circle cx={x} cy={y} r={r} fill={fill} /><circle cx={x} cy={y} r={r * 0.62} fill="none" stroke="white" strokeOpacity=".55" strokeWidth={Math.max(1.5, r / 9)} /></g>
);

// 0 - a dApp: swap card with two tokens and a swap arrow, floating coins around it
export const DappIllustration: React.FC = () => (
  <Frame label="A decentralised app showing a token swap">
    <rect width="466" height="360" fill="#f5f5f1" />
    <circle cx="70" cy="70" r="46" fill={SOFT} /><circle cx="410" cy="300" r="58" fill={SOFT} />
    <Coin x={78} y={296} r={16} /><Coin x={398} y={62} r={12} /><Coin x={430} y={140} r={7} fill={INK} />
    <g transform="translate(103 62)">
      <rect width="260" height="236" rx="22" fill="white" stroke={LINE} />
      <rect x="20" y="20" width="90" height="12" rx="6" fill={INK} opacity=".85" />
      <rect x="20" y="42" width="140" height="8" rx="4" fill={LINE} />
      <rect x="20" y="70" width="220" height="62" rx="14" fill="#f5f5f1" /><Coin x={46} y={101} r={16} /><rect x="72" y="88" width="48" height="10" rx="5" fill={INK} opacity=".8" /><rect x="72" y="106" width="30" height="8" rx="4" fill={LINE} /><rect x="170" y="94" width="56" height="14" rx="7" fill={INK} opacity=".7" />
      <circle cx="130" cy="144" r="17" fill={B} stroke="white" strokeWidth="4" />
      <path d="M124 139l6-5 6 5M136 149l-6 5-6-5" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="20" y="156" width="220" height="62" rx="14" fill="#f5f5f1" /><Coin x={46} y={187} r={16} fill={INK} /><rect x="72" y="174" width="48" height="10" rx="5" fill={INK} opacity=".8" /><rect x="72" y="192" width="30" height="8" rx="4" fill={LINE} /><rect x="170" y="180" width="56" height="14" rx="7" fill={INK} opacity=".7" />
    </g>
  </Frame>
);

// 1 - browser window with the wallet docked in the side panel
export const SidePanelIllustration: React.FC = () => (
  <Frame label="A browser window with the wallet open in the side panel">
    <rect width="466" height="360" fill="#f5f5f1" />
    <g transform="translate(48 44)">
      <rect width="370" height="272" rx="18" fill="white" stroke={LINE} />
      <path d="M0 18a18 18 0 0 1 18-18h334a18 18 0 0 1 18 18v26H0z" fill="#ecefea" />
      <circle cx="22" cy="22" r="5" fill="#e26d5c" /><circle cx="40" cy="22" r="5" fill="#e8b84a" /><circle cx="58" cy="22" r="5" fill="#5fb46b" />
      <rect x="80" y="12" width="190" height="20" rx="10" fill="white" stroke={LINE} /><circle cx="338" cy="22" r="8" fill={B} />
      <rect x="20" y="62" width="120" height="12" rx="6" fill={INK} opacity=".8" /><rect x="20" y="84" width="170" height="8" rx="4" fill={LINE} /><rect x="20" y="100" width="150" height="8" rx="4" fill={LINE} />
      <rect x="20" y="126" width="170" height="112" rx="12" fill="#f5f5f1" /><path d="M32 214l30-34 24 20 28-38 30 32" fill="none" stroke={B} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <g transform="translate(222 52)"><rect width="134" height="208" rx="14" fill="white" stroke={B} strokeWidth="2" />
        <rect x="12" y="14" width="56" height="9" rx="4.5" fill={INK} opacity=".85" /><circle cx="116" cy="19" r="7" fill={SOFT} />
        <rect x="12" y="36" width="80" height="20" rx="6" fill={INK} opacity=".85" />
        {[0, 1, 2, 3].map((i) => <g key={i} transform={`translate(12 ${72 + i * 30})`}><Coin x={10} y={10} r={10} fill={i % 2 ? INK : B} /><rect x="28" y="2" width="40" height="7" rx="3.5" fill={INK} opacity=".7" /><rect x="28" y="14" width="26" height="6" rx="3" fill={LINE} /><rect x="78" y="6" width="32" height="8" rx="4" fill={INK} opacity=".55" /></g>)}
      </g>
    </g>
  </Frame>
);

// 2 - toolbar with the extensions puzzle piece and a pinned wallet icon
export const ToolbarIllustration: React.FC = () => (
  <Frame label="A browser toolbar with the wallet pinned">
    <rect width="466" height="360" fill="#f5f5f1" />
    <g transform="translate(36 112)">
      <rect width="394" height="64" rx="32" fill="white" stroke={LINE} />
      <path d="M26 32h18M31 26l-6 6 6 6M62 32H44" fill="none" stroke={LINE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="88" y="16" width="170" height="32" rx="16" fill="#f5f5f1" /><rect x="104" y="29" width="90" height="7" rx="3.5" fill={LINE} />
      <path d="M284 40v-8a4 4 0 0 1 4-4h5a5 5 0 1 1 10 0h5a4 4 0 0 1 4 4v5a5 5 0 1 0 0 10v5a4 4 0 0 1-4 4h-24z" fill="none" stroke={INK} strokeOpacity=".6" strokeWidth="2.4" transform="translate(-8 -8) scale(1.05)" />
      <circle cx="352" cy="32" r="21" fill={SOFT} /><rect x="339" y="21" width="26" height="22" rx="6" fill={B} /><path d="M345 32h14M352 26v12" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
    </g>
    <g transform="translate(364 150)"><path d="M0 50c8-22 20-34 40-40" fill="none" stroke={B} strokeWidth="3" strokeDasharray="2 7" strokeLinecap="round" /><path d="M30 2l12 8-14 6" fill="none" stroke={B} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></g>
    <g transform="translate(150 214)"><rect width="190" height="74" rx="14" fill="white" stroke={LINE} /><rect x="16" y="14" width="70" height="9" rx="4.5" fill={INK} opacity=".8" />
      <g transform="translate(16 36)"><rect width="26" height="26" rx="8" fill={SOFT} /><rect x="6" y="6" width="14" height="14" rx="4" fill={B} /><rect x="36" y="4" width="80" height="8" rx="4" fill={INK} opacity=".7" /><rect x="36" y="16" width="52" height="6" rx="3" fill={LINE} /><path d="M146 18l5 5 11-12" fill="none" stroke={B} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></g></g>
  </Frame>
);
