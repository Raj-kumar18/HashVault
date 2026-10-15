import { logger } from './logger.js';

/**
 * Ensures collector has a valid server-specific credential, performing one-time
 * token enrollment exchange if necessary.
 */
export async function ensureEnrolled(config, stateStore) {
  // 1. Check existing state store credentials
  const stored = stateStore.loadCredential();
  if (stored && stored.credential && stored.serverId === config.serverId) {
    logger.info(
      'Enrollment',
      `Using established collector credential for server ${config.serverId} (v${stored.credentialVersion || 1})`
    );
    config.credential = stored.credential;
    config.credentialVersion = stored.credentialVersion || 1;
    return stored.credential;
  }

  // 2. Check direct configuration credential override
  if (config.credential) {
    logger.info('Enrollment', `Using configured collector credential for server ${config.serverId}`);
    stateStore.saveCredential(config.serverId, config.credential);
    return config.credential;
  }

  // 3. One-time enrollment token exchange
  if (!config.enrollmentToken) {
    throw new Error(
      `Collector on server [${config.serverId}] is not enrolled. No stored credential found and no enrollmentToken provided.`
    );
  }

  logger.info('Enrollment', `Initiating one-time token exchange for server [${config.serverId}]...`);

  const enrollUrl = `${config.backendUrl.replace(/\/+$/, '')}/collector/enroll`;
  const payload = {
    token: config.enrollmentToken.trim(),
    serverId: config.serverId.trim(),
  };

  let response;
  try {
    response = await fetch(enrollUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    throw new Error(`Enrollment network failure: could not reach ${enrollUrl} (${err.message})`);
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.message || data?.error || `HTTP ${response.status}`;
    if (response.status === 403) {
      throw new Error(`Enrollment rejected: Server [${config.serverId}] is disabled.`);
    }
    throw new Error(`Enrollment failed (HTTP ${response.status}): ${errorMsg}`);
  }

  if (!data?.credential) {
    throw new Error('Enrollment protocol error: Backend did not return a collector credential.');
  }

  const credential = data.credential;
  const credentialVersion = data.credentialVersion || 1;

  // Persist credential in state store with 0600 permissions
  stateStore.saveCredential(config.serverId, credential, credentialVersion);

  // Clear in-memory enrollment token so it is not retained
  config.enrollmentToken = '';
  config.credential = credential;
  config.credentialVersion = credentialVersion;

  logger.info(
    'Enrollment',
    `Successfully enrolled server [${config.serverId}]! Collector credential v${credentialVersion} saved.`
  );

  return credential;
}
