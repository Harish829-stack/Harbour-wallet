// Screens for feature "ledger": register { screenName: Component } here; they are merged into the wallet's SCREENS registry.
import type React from 'react';
import type { Ctx } from '../types';
import { ImportLedgerScreen } from '../../ledger/ImportLedger';
export const SCREENS_ledger: Record<string, React.FC<Ctx>> = { importLedger: ImportLedgerScreen };
