module.exports = {
  testDir: '.',
  timeout: 15000,
  fullyParallel: false,
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node server.js',
    port: 8080,
    timeout: 10000,
    cwd: __dirname,
  },
};
