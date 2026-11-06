// Node 22+: node --experimental-strip-types clients/ts/smoke.ts http://localhost:8080
// Proves the extension-side signing interoperates with the Go API.
import { generateDeviceKey, registerDevice, signedFetch } from "./hbclient.ts";

const base = process.argv[2] ?? "http://localhost:8080";
const { privateKey, publicKeyB64 } = await generateDeviceKey();
const t0 = Date.now();
const id = await registerDevice(base, privateKey, publicKeyB64);
console.log(`registered ${id.deviceId} in ${Date.now() - t0} ms`);
console.log("me:", JSON.stringify(await signedFetch(base, id, "GET", "/v1/me")));
const put = await signedFetch(base, id, "PUT", "/v1/me/addresses", {
  add: [{ chain: "base", address: "0x4200000000000000000000000000000000000006" }],
}, { "Idempotency-Key": crypto.randomUUID() });
console.log("addresses:", JSON.stringify(put));
