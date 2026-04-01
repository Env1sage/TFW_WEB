const http = require('http');
const req = (method, path, body, token) => new Promise((resolve, reject) => {
  const opts = { hostname: 'localhost', port: 5001, path: '/api' + path, method, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  const r = http.request(opts, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve({status:res.statusCode,body:d})); });
  r.on('error', reject);
  if (body) r.write(JSON.stringify(body));
  r.end();
});

(async () => {
  const results = { pass: 0, fail: 0, critical: [] };
  const check = (name, cond, detail) => {
    if (cond) { results.pass++; console.log(`  ✅ ${name}`); }
    else { results.fail++; console.log(`  ❌ ${name} — ${detail || ''}`); results.critical.push(name); }
  };

  // === 1. Public Endpoints ===
  console.log('\n📦 PUBLIC ENDPOINTS');
  const products = await req('GET', '/products');
  check('GET /products returns 200', products.status === 200);
  const categories = await req('GET', '/products/categories');
  check('GET /categories returns 200', categories.status === 200);
  const coupons = await req('GET', '/products/coupons/active');
  check('GET /coupons/active returns 200', coupons.status === 200);
  const mockups = await req('GET', '/products/mockups/active');
  check('GET /mockups/active returns 200', mockups.status === 200);

  // === 2. Auth-Protected Endpoints Without Token ===
  console.log('\n🔒 AUTH ENFORCEMENT (no token — should reject)');
  const e1 = await req('GET', '/products/orders/mine');
  check('/orders/mine rejects without auth', e1.status === 401, `got ${e1.status}`);
  const e2 = await req('GET', '/products/orders/all');
  check('/orders/all rejects without auth', e2.status === 401, `got ${e2.status}`);
  const e3 = await req('GET', '/products/coupons');
  check('/coupons (admin) rejects without auth', e3.status === 401, `got ${e3.status}`);
  const e4 = await req('GET', '/products/db-viewer');
  check('/db-viewer rejects without auth', e4.status === 401, `got ${e4.status}`);
  const e5 = await req('GET', '/products/analytics');
  check('/analytics rejects without auth', e5.status === 401, `got ${e5.status}`);
  const e6 = await req('POST', '/products/orders', {items:[]});
  check('POST /orders rejects without auth', e6.status === 401, `got ${e6.status}`);
  const e7 = await req('GET', '/products/saved-designs');
  check('/saved-designs rejects without auth', e7.status === 401, `got ${e7.status}`);

  // === 3. CRITICAL: Design-Order Endpoints Without Auth ===
  console.log('\n🔴 CRITICAL: DESIGN-ORDER AUTH');
  const d1 = await req('GET', '/products/design-orders/00000000-0000-0000-0000-000000000000');
  check('GET /design-orders/:id SHOULD reject without auth', d1.status === 401, `got ${d1.status} — UNAUTHENTICATED ACCESS!`);
  const d2 = await req('PUT', '/products/design-orders/00000000-0000-0000-0000-000000000000', {status:'cancelled'});
  check('PUT /design-orders/:id SHOULD reject without auth', d2.status === 401, `got ${d2.status} — UNAUTHENTICATED MODIFICATION!`);

  // === 4. Login Tests ===
  console.log('\n🔐 AUTHENTICATION');
  const badLogin = await req('POST', '/auth/login', {email:'nobody@x.com', password:'wrong'});
  check('Bad credentials return 401', badLogin.status === 401, `got ${badLogin.status}`);
  const login = await req('POST', '/auth/login', {email:'admin@theframedwall.com', password:'admin123'});
  check('Admin login succeeds', login.status === 200, `got ${login.status}`);
  const token = login.status === 200 ? JSON.parse(login.body).token : null;

  // === 5. Admin Role Enforcement ===
  if (token) {
    console.log('\n👤 ROLE-BASED ACCESS');
    // Create a regular user to test role enforcement
    const regRes = await req('POST', '/auth/register', {name:'TestUser', email:'testuser_sec@test.com', password:'test123456'});
    let userToken = null;
    if (regRes.status === 201 || regRes.status === 200) {
      userToken = JSON.parse(regRes.body).token;
    } else {
      // Try login if already exists
      const ul = await req('POST', '/auth/login', {email:'testuser_sec@test.com', password:'test123456'});
      if (ul.status === 200) userToken = JSON.parse(ul.body).token;
    }
    if (userToken) {
      const r1 = await req('GET', '/products/orders/all', null, userToken);
      check('Regular user cannot access /orders/all', r1.status === 403, `got ${r1.status}`);
      const r2 = await req('GET', '/products/db-viewer', null, userToken);
      check('Regular user cannot access /db-viewer', r2.status === 403, `got ${r2.status}`);
      const r3 = await req('GET', '/products/analytics', null, userToken);
      check('Regular user cannot access /analytics', r3.status === 403, `got ${r3.status}`);
      const r4 = await req('POST', '/products', {name:'hack',price:1}, userToken);
      check('Regular user cannot create products', r4.status === 403, `got ${r4.status}`);
      const r5 = await req('POST', '/products/coupons', {code:'HACK',discountType:'fixed',discountValue:100}, userToken);
      check('Regular user cannot create coupons', r5.status === 403, `got ${r5.status}`);
    }
  }

  // === 6. Input Validation ===
  console.log('\n📝 INPUT VALIDATION');
  const weakPw = await req('POST', '/auth/register', {name:'test', email:'weak@pw.com', password:'123'});
  check('Reject weak password (<6 chars)', weakPw.status >= 400, `got ${weakPw.status}`);
  const noEmail = await req('POST', '/auth/register', {name:'test', password:'123456'});
  check('Reject registration without email', noEmail.status >= 400, `got ${noEmail.status}`);
  const badCoupon = await req('POST', '/products/coupons/validate', {code:'NONEXISTENT', orderAmount:100});
  check('Invalid coupon code returns error', badCoupon.status >= 400, `got ${badCoupon.status}`);

  // === 7. SQL Injection ===
  console.log('\n💉 SQL INJECTION TESTS');
  const sqli1 = await req('POST', '/auth/login', {email:"' OR 1=1 --", password:'anything'});
  check('SQLi in login blocked', sqli1.status === 401, `got ${sqli1.status}`);
  const sqli2 = await req('GET', "/products?search=' OR 1=1; DROP TABLE--");
  check('SQLi in product search blocked', sqli2.status === 200 || sqli2.status === 400, `got ${sqli2.status}`);

  // === 8. Corporate inquiry (spam risk) ===
  console.log('\n📨 CORPORATE INQUIRY');
  const corp = await req('POST', '/products/corporate-inquiry', {companyName:'Test',contactName:'Test',email:'test@test.com',phone:'1234567890',message:'test'});
  check('Corporate inquiry accepts valid data', corp.status === 201 || corp.status === 200, `got ${corp.status}`);

  // === SUMMARY ===
  console.log('\n' + '='.repeat(50));
  console.log(`📊 RESULTS: ${results.pass} passed, ${results.fail} failed`);
  if (results.critical.length) {
    console.log('\n🚨 FAILED TESTS:');
    results.critical.forEach(c => console.log(`   • ${c}`));
  }
  console.log('='.repeat(50));
})().catch(e => console.error('Test error:', e.message));
