// Import instructions shown beside the secret-phrase form (TW chunks/import-mnemonic-or-private-key `Ne`, ids import-wallet.*).
// `**x**` = bold, `{{menu}}` = the vertical-dots icon, `{{gear}}` = the settings icon. TW ships animated GIFs; Harbour draws one original
// glyph per step instead (icon name below), so no third-party artwork is bundled.
export type InstructionProduct = 'trust-wallet' | 'other';
export interface InstructionStep { id: string; icon: 'wallet' | 'menu' | 'shield' | 'settings' | 'lock' | 'manage' | 'phrase'; text: string }
export interface InstructionSet {
  product: InstructionProduct; header: string; subHeader: string; inputLabel: string; inputHint: string;
  platforms: Array<{ title: string; steps: InstructionStep[] }>;
}
export const INSTRUCTIONS: Record<InstructionProduct, InstructionSet> = {
  'trust-wallet': {
    product: 'trust-wallet', header: 'Locate your Secret Phrase on Trust Wallet', subHeader: 'Import with Secret Phrase or Private Key',
    inputLabel: 'Enter Secret Phrase or Private Key',
    inputHint: 'Secret Phrase is typically 12 (sometimes 18, 24) words separated by single spaces\nPrivate Key is a long alphanumeric code',
    platforms: [
      { title: 'Mobile', steps: [
        { id: 'tw-mobile-1', icon: 'wallet', text: '1. On your **Trust Wallet** mobile app Homepage click on your **Wallet**' },
        { id: 'tw-mobile-2', icon: 'menu', text: '2. Click on the “{{menu}}“ and select “**Back up now**”' },
        { id: 'tw-mobile-3', icon: 'shield', text: '3. Follow the security steps to retrieve your **Secret Phrase**' },
      ] },
      { title: 'Extension', steps: [
        { id: 'tw-ext-1', icon: 'manage', text: '1. On your Trust Wallet extension Homepage click on your **Wallet** and "**Manage Wallets**"' },
        { id: 'tw-ext-2', icon: 'phrase', text: '2. Select your wallet and "**Secret Phrase**"' },
        { id: 'tw-ext-3', icon: 'shield', text: '3. Follow the security steps to retrieve your **Secret Phrase**' },
      ] },
    ],
  },
  other: {
    product: 'other', header: 'Locate your Secret Phrase or Private Key on wallets', subHeader: 'Import with Secret Phrase or Private Key',
    inputLabel: 'Enter Secret Phrase or Private Key',
    inputHint: 'Secret Recovery Phrase is typically 12 (sometimes 18, 24) words separated by single spaces\nPrivate Key is a long alphanumeric code',
    platforms: [
      { title: 'Mobile', steps: [
        { id: 'other-mobile-1', icon: 'settings', text: '1. On your wallet Homepage, go to “**Settings**”' },
        { id: 'other-mobile-2', icon: 'lock', text: '2. Select “**Security & Privacy**” and look for “**Secret Phrase**” or “**Private Key**”' },
        { id: 'other-mobile-3', icon: 'shield', text: '3. Follow the verification steps to view your **Secret Phrase** or **Private Key**' },
      ] },
    ],
  },
};
/** Splits a step string into text / bold / icon segments for rendering. */
export function parseInstruction(text: string): Array<{ k: 'text' | 'bold' | 'menu' | 'gear'; v: string }> {
  const out: Array<{ k: 'text' | 'bold' | 'menu' | 'gear'; v: string }> = [];
  const re = /\*\*(.+?)\*\*|\{\{(menu|gear)\}\}/g; let last = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ k: 'text', v: text.slice(last, m.index) });
    if (m[1] != null) out.push({ k: 'bold', v: m[1] }); else out.push({ k: m[2] as 'menu' | 'gear', v: '' });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ k: 'text', v: text.slice(last) });
  return out;
}
