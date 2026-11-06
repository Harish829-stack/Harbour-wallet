import test from 'node:test'; import assert from 'node:assert'; import { readFileSync } from 'node:fs';
const fx = JSON.parse(readFileSync(new URL('./fixtures/tw-listings.json', import.meta.url), 'utf8'));
test('HAR listings fixtures have the documented shape', () => {
  for (const [cid, f] of Object.entries(fx)) {
    assert.ok(Array.isArray(f.response.docs) && f.response.docs.length > 0, cid);
    for (const d of f.response.docs) {
      assert.ok(d.asset.asset_id && d.asset.symbol && typeof d.asset.network === 'number');
      for (const k of ['percent_change_1h','percent_change_24h','percent_change_7d','percent_change_30d','price']) assert.equal(typeof d.price[k], 'number');
      assert.equal(typeof d.market.market_cap, 'number'); assert.equal(typeof d.market.volume_24h, 'number');
    }
  }
});
test('default network set matches capture', () => {
  assert.equal(fx.trending_ave.query.networks, '20000714,501,60,8453,10004663,10005042,10000999');
  assert.equal(fx.trending.query.sort_field, 'volume_24h');
});
