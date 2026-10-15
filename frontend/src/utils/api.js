/**
 * HashVault API Utility
 * Uses Fetch API with credentials (cookies) and CSRF token handling.
 */

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api';

// In-memory cached CSRF token
let cachedCsrfToken = null;

/**
 * Fetch and cache a CSRF token from the backend.
 */
export async function fetchCsrfToken() {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/csrf-token`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.csrfToken) {
        cachedCsrfToken = data.csrfToken;
        return cachedCsrfToken;
      }
    }
  } catch (err) {
    console.warn('[HashVault API] Failed to fetch CSRF token:', err.message);
  }
  return null;
}

/**
 * Generic Fetch wrapper handling JSON envelopes, CSRF headers, and cookies.
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const method = (options.method || 'GET').toUpperCase();

  const headers = {
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  // State-changing requests require a CSRF token
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    if (!cachedCsrfToken) {
      await fetchCsrfToken();
    }
    if (cachedCsrfToken) {
      headers['X-CSRF-Token'] = cachedCsrfToken;
    }
  }

  const response = await fetch(url, {
    ...options,
    method,
    headers,
    credentials: 'include', // Send session cookie
  });

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await response.json() : null;

  // Cache new CSRF token if returned in response payload
  if (data?.csrfToken) {
    cachedCsrfToken = data.csrfToken;
  }

  if (!response.ok) {
    const errorMsg = data?.message || data?.error || `Request failed with status ${response.status}`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

/* ==================== Authentication API ==================== */

export async function apiSignup({ name, email, password }) {
  return request('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
}

export async function apiLogin({ email, password }) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function apiLogout() {
  const result = await request('/auth/logout', {
    method: 'POST',
  });
  cachedCsrfToken = null;
  return result;
}

export async function apiGetMe() {
  return request('/auth/me', {
    method: 'GET',
  });
}

export async function apiTestRbac(endpoint) {
  return request(`/auth/test/${endpoint}`, {
    method: 'GET',
  });
}

/* ==================== Server Fleet Management API (Phase 2) ==================== */

export async function apiGetServers(params = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.os && params.os !== 'all') query.set('os', params.os);
  if (params.environment && params.environment !== 'all') query.set('environment', params.environment);
  if (params.enrollmentStatus && params.enrollmentStatus !== 'all') query.set('enrollmentStatus', params.enrollmentStatus);
  if (params.connectionStatus && params.connectionStatus !== 'all') query.set('connectionStatus', params.connectionStatus);
  if (params.page) query.set('page', params.page);
  if (params.limit) query.set('limit', params.limit);

  const queryString = query.toString();
  return request(`/servers${queryString ? `?${queryString}` : ''}`, {
    method: 'GET',
  });
}

export async function apiGetServer(id) {
  return request(`/servers/${id}`, {
    method: 'GET',
  });
}

export async function apiCreateServer(serverData) {
  return request('/servers', {
    method: 'POST',
    body: JSON.stringify(serverData),
  });
}

export async function apiUpdateServer(id, serverData) {
  return request(`/servers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(serverData),
  });
}

export async function apiDisableServer(id) {
  return request(`/servers/${id}/disable`, {
    method: 'POST',
  });
}

export async function apiDeleteServer(id) {
  return request(`/servers/${id}`, {
    method: 'DELETE',
  });
}

export async function apiGenerateEnrollmentToken(id) {
  return request(`/servers/${id}/enrollment-token`, {
    method: 'POST',
  });
}

export async function apiRotateCredential(id) {
  return request(`/servers/${id}/rotate-credential`, {
    method: 'POST',
  });
}

export async function apiGetServerLogs(id, params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page);
  if (params.limit) query.set('limit', params.limit);
  if (params.source) query.set('source', params.source);
  const queryString = query.toString();
  return request(`/servers/${id}/logs${queryString ? `?${queryString}` : ''}`, {
    method: 'GET',
  });
}

/* ==================== Tamper-Evident Integrity API (Phase 4) ==================== */

export async function apiGetIntegritySummary(serverId) {
  return request(`/integrity/servers/${serverId}/summary`, {
    method: 'GET',
  });
}

export async function apiGetIntegrityEvents(serverId, params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page);
  if (params.limit) query.set('limit', params.limit);
  if (params.fromSequence) query.set('fromSequence', params.fromSequence);
  if (params.toSequence) query.set('toSequence', params.toSequence);
  if (params.search) query.set('search', params.search);
  const queryString = query.toString();
  return request(`/integrity/servers/${serverId}/events${queryString ? `?${queryString}` : ''}`, {
    method: 'GET',
  });
}

export async function apiGetIntegrityEvent(serverId, sequenceNumber) {
  return request(`/integrity/servers/${serverId}/events/${sequenceNumber}`, {
    method: 'GET',
  });
}

export async function apiVerifyIntegrity(serverId, range = {}) {
  return request(`/integrity/servers/${serverId}/verify`, {
    method: 'POST',
    body: JSON.stringify(range),
  });
}

/* ==================== Blockchain Checkpoints API (Phase 5) ==================== */

export async function apiGetBlockchainStatus() {
  return request('/blockchain/status', {
    method: 'GET',
  });
}

export async function apiGetCheckpoints(serverId, params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page);
  if (params.limit) query.set('limit', params.limit);
  if (params.status && params.status !== 'all') query.set('status', params.status);

  const queryString = query.toString();
  return request(`/integrity/servers/${serverId}/checkpoints${queryString ? `?${queryString}` : ''}`, {
    method: 'GET',
  });
}

export async function apiGetCheckpoint(serverId, checkpointId) {
  return request(`/integrity/servers/${serverId}/checkpoints/${checkpointId}`, {
    method: 'GET',
  });
}

export async function apiCreateCheckpoint(serverId, { startSequence, endSequence }) {
  return request(`/integrity/servers/${serverId}/checkpoints`, {
    method: 'POST',
    body: JSON.stringify({ startSequence, endSequence }),
  });
}

export async function apiVerifyCheckpoint(serverId, checkpointId) {
  return request(`/integrity/servers/${serverId}/checkpoints/${checkpointId}/verify`, {
    method: 'POST',
  });
}

/* ==================== Monitoring, Alerts & Simulator API (Phase 6) ==================== */

export async function apiGetMonitoringOverview() {
  return request('/monitoring/overview', {
    method: 'GET',
  });
}

export async function apiGetMonitoredServers() {
  return request('/monitoring/servers', {
    method: 'GET',
  });
}

export async function apiTriggerMonitoringCycle() {
  return request('/monitoring/cycle', {
    method: 'POST',
  });
}

export async function apiGetAlerts(params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page);
  if (params.limit) query.set('limit', params.limit);
  if (params.status && params.status !== 'ALL') query.set('status', params.status);
  if (params.severity && params.severity !== 'ALL') query.set('severity', params.severity);
  if (params.alertType && params.alertType !== 'ALL') query.set('alertType', params.alertType);
  if (params.serverId) query.set('serverId', params.serverId);
  if (params.search) query.set('search', params.search);

  const queryString = query.toString();
  return request(`/alerts${queryString ? `?${queryString}` : ''}`, {
    method: 'GET',
  });
}

export async function apiGetAlert(alertId) {
  return request(`/alerts/${alertId}`, {
    method: 'GET',
  });
}

export async function apiAcknowledgeAlert(alertId) {
  return request(`/alerts/${alertId}/acknowledge`, {
    method: 'POST',
  });
}

export async function apiResolveAlert(alertId, { resolutionNotes } = {}) {
  return request(`/alerts/${alertId}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ resolutionNotes }),
  });
}

export async function apiGetSimulations() {
  return request('/simulations', {
    method: 'GET',
  });
}

export async function apiRunSimulation(scenarioId) {
  return request(`/simulations/${scenarioId}/run`, {
    method: 'POST',
  });
}

/* ==================== Phase 7: Overview & Logs Explorer APIs ==================== */

export async function apiGetOverview() {
  return request('/overview', {
    method: 'GET',
  });
}

export async function apiGetLogs(params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page);
  if (params.limit) query.set('limit', params.limit);
  if (params.search) query.set('search', params.search);
  if (params.serverId && params.serverId !== 'all') query.set('serverId', params.serverId);
  if (params.source && params.source !== 'all') query.set('source', params.source);
  if (params.startDate) query.set('startDate', params.startDate);
  if (params.endDate) query.set('endDate', params.endDate);
  if (params.minSequence) query.set('minSequence', params.minSequence);
  if (params.maxSequence) query.set('maxSequence', params.maxSequence);
  if (params.sortBy) query.set('sortBy', params.sortBy);
  if (params.sortOrder) query.set('sortOrder', params.sortOrder);

  const qs = query.toString();
  return request(`/logs${qs ? `?${qs}` : ''}`, {
    method: 'GET',
  });
}

export async function apiGetLogEvent(eventId) {
  return request(`/logs/${eventId}`, {
    method: 'GET',
  });
}

/* ==================== Collector Enrollment API (Phase 2) ==================== */

export async function apiEnrollCollector({ token, serverId }) {
  // Machine-facing collector endpoint, but useful for testing/simulation
  const res = await fetch(`${API_BASE_URL}/collector/enroll`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ token, serverId }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const errorMsg = data?.message || data?.error || `Enrollment failed with HTTP ${res.status}`;
    const error = new Error(errorMsg);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}


/* ==================== Health Probes (Phase 0) ==================== */

export async function checkApiHealth() {
  const startTime = performance.now();
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });

    const latency = Math.round(performance.now() - startTime);

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        statusText: response.statusText,
        latency,
        error: `Server responded with HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      status: response.status,
      latency,
      data,
    };
  } catch (err) {
    const latency = Math.round(performance.now() - startTime);
    return {
      success: false,
      status: 0,
      latency,
      error: err.message || 'Network error or backend unreachable',
    };
  }
}

export async function checkDbHealth() {
  const startTime = performance.now();
  try {
    const response = await fetch(`${API_BASE_URL}/health/db`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });

    const latency = Math.round(performance.now() - startTime);
    const data = await response.json().catch(() => null);

    return {
      success: response.ok,
      status: response.status,
      latency,
      data,
      connected: data?.connected === true,
      message: data?.message || (response.ok ? 'Database connected' : 'Database disconnected'),
    };
  } catch (err) {
    const latency = Math.round(performance.now() - startTime);
    return {
      success: false,
      status: 0,
      latency,
      connected: false,
      error: err.message || 'Could not verify database connection',
      message: 'Backend unreachable to query database status',
    };
  }
}

/* ========================================================
   Phase 8: VaultAI Security Intelligence Endpoints
   ======================================================== */

/**
 * GET /api/ai/status
 * Queries safe AI provider readiness.
 */
export async function apiGetAiStatus() {
  return request('/ai/status');
}

/**
 * POST /api/ai/analyses
 * Initiates an evidence-backed security investigation through LangGraph.
 */
export async function apiCreateAnalysis({ serverId, startTime, endTime, alertIds = [], question }) {
  return request('/ai/analyses', {
    method: 'POST',
    body: JSON.stringify({
      serverId,
      startTime,
      endTime,
      alertIds,
      question,
    }),
  });
}

/**
 * GET /api/ai/analyses
 * Lists paginated historical investigation reports.
 */
export async function apiListAnalyses(params = {}) {
  const query = new URLSearchParams();
  if (params.serverId) query.set('serverId', params.serverId);
  if (params.riskLevel) query.set('riskLevel', params.riskLevel);
  if (params.status) query.set('status', params.status);
  if (params.page) query.set('page', params.page);
  if (params.limit) query.set('limit', params.limit);
  if (params.search) query.set('search', params.search);

  const qs = query.toString();
  return request(`/ai/analyses${qs ? `?${qs}` : ''}`);
}

/**
 * GET /api/ai/analyses/:analysisId
 * Retrieves full investigation report.
 */
export async function apiGetAnalysis(analysisId) {
  return request(`/ai/analyses/${encodeURIComponent(analysisId)}`);
}

/**
 * POST /api/ai/analyses/:analysisId/feedback
 * Records analyst feedback on findings accuracy.
 */
export async function apiSubmitFeedback(analysisId, { helpful, notes = '' }) {
  return request(`/ai/analyses/${encodeURIComponent(analysisId)}/feedback`, {
    method: 'POST',
    body: JSON.stringify({ helpful, notes }),
  });
}

/**
 * GET /api/ai/analyses/:analysisId/compare/:otherId
 * Compares two historical analyses for the same server.
 */
export async function apiCompareAnalyses(analysisId, otherId) {
  return request(`/ai/analyses/${encodeURIComponent(analysisId)}/compare/${encodeURIComponent(otherId)}`);
}

export { API_BASE_URL };
