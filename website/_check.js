const http = require('http');

function check(port, name) {
  return new Promise(resolve => {
    const req = http.get(`http://localhost:${port}/`, res => {
      resolve(`${name} (port ${port}): UP (status ${res.statusCode})`);
      res.resume();
    });
    req.on('error', e => resolve(`${name} (port ${port}): DOWN (${e.code})`));
    req.setTimeout(3000, () => { req.destroy(); resolve(`${name} (port ${port}): TIMEOUT`); });
  });
}

Promise.all([check(5001, 'API'), check(3000, 'Vite')]).then(results => {
  results.forEach(r => console.log(r));
});
