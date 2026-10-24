// Isolated browser tests must never connect to the configured production database.
module.exports = `Object.defineProperty(window, 'HOMELODY_CONFIG', {
  configurable: true,
  set(value) {
    value.supabaseUrl = ''; value.supabaseKey = '';
    Object.defineProperty(window, 'HOMELODY_CONFIG', { value, writable: true, configurable: true });
  }
});`;
