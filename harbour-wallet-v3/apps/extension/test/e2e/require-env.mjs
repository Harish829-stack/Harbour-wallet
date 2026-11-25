// `npm run test:e2e` must not pass by skipping: fail fast when the full-stack environment is missing.
import { stackRequirements } from './stack.mjs';
const missing = stackRequirements();
if (missing.length) { console.error(`E2E environment missing: ${missing.join(', ')}\nSee test/README.md (End-to-end).`); process.exit(1); }
