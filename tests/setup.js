const superagent = require('superagent');

const originalEnd = superagent.Request.prototype.end;

superagent.Request.prototype.end = function patchedEnd(callback) {
  const url = String(this.url || this._url || '');
  const skip = this.get && this.get('X-Supertest-Skip-CSRF') === '1';

  if (!skip && url.includes('/api') && typeof this.method === 'string') {
    const method = this.method.toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      this.set('X-Requested-With', 'school-erp');
    }
  }

  return originalEnd.call(this, callback);
};
