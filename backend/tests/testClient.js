/**
 * Lightweight HTTP test client tracking session cookies and CSRF tokens across requests
 */
export class TestClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cookies = new Map();
    this.csrfToken = null;
    this.defaultHeaders = {};
  }

  setHeaders(headers) {
    this.defaultHeaders = { ...this.defaultHeaders, ...headers };
  }

  setCookieFromHeader(header) {
    if (!header) return;
    const cookieStrings = Array.isArray(header) ? header : [header];
    for (const str of cookieStrings) {
      const parts = str.split(';');
      const [nameVal] = parts;
      const [key, ...valParts] = nameVal.split('=');
      if (key) {
        this.cookies.set(key.trim(), valParts.join('=').trim());
      }
    }
  }

  getCookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  clearCookies() {
    this.cookies.clear();
    this.csrfToken = null;
  }

  async fetchCsrf() {
    const res = await this.get('/api/auth/csrf-token');
    if (res.data?.csrfToken) {
      this.csrfToken = res.data.csrfToken;
    }
    return this.csrfToken;
  }

  async request(method, path, body = null, customHeaders = {}) {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      Accept: 'application/json',
      ...this.defaultHeaders,
      ...customHeaders,
    };

    const cookieHeader = this.getCookieHeader();
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    if (this.csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
      if (!('X-CSRF-Token' in headers)) {
        headers['X-CSRF-Token'] = this.csrfToken;
      }
    }

    const options = {
      method: method.toUpperCase(),
      headers,
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    const res = await fetch(url, options);

    // Track Set-Cookie headers
    const rawSetCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean);
    if (rawSetCookie && rawSetCookie.length > 0) {
      this.setCookieFromHeader(rawSetCookie);
    }

    const isJson = res.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await res.json() : null;

    if (data?.csrfToken) {
      this.csrfToken = data.csrfToken;
    }

    return {
      status: res.status,
      headers: res.headers,
      data,
    };
  }

  get(path, headers = {}) {
    return this.request('GET', path, null, headers);
  }

  post(path, body = {}, headers = {}) {
    return this.request('POST', path, body, headers);
  }

  patch(path, body = {}, headers = {}) {
    return this.request('PATCH', path, body, headers);
  }
}

