const { Pool } = require('pg');
const p = new Pool({ connectionString: 'postgresql://tfw:tfwpassword@localhost:5433/tfw_db' });

async function main() {
  // Fix SAVE20: remove max_uses limit so it can show as popup
  await p.query(`UPDATE website_coupons SET max_uses = NULL WHERE code = 'SAVE20'`);
  console.log('Fixed SAVE20: removed max_uses limit');

  // Fix SAVE30: set valid_from to now so it's immediately valid
  await p.query(`UPDATE website_coupons SET valid_from = NOW() WHERE code = 'SAVE30'`);
  console.log('Fixed SAVE30: set valid_from to now');

  // Now test the popup query
  const now = new Date().toISOString();
  console.log('Now:', now);
  const { rows } = await p.query(
    `SELECT id, code, popup_enabled, active, discount_value, valid_from, valid_until, max_uses, use_count
     FROM website_coupons
     WHERE popup_enabled = true AND active = true
       AND (valid_from IS NULL OR valid_from <= $1)
       AND (valid_until IS NULL OR valid_until >= $1)
       AND (max_uses IS NULL OR use_count < max_uses)
     ORDER BY created_at DESC LIMIT 1`,
    [now]
  );
  console.log('Popup query result:', JSON.stringify(rows, null, 2));
  await p.end();
}

main().catch(e => { console.error(e); process.exit(1); });
