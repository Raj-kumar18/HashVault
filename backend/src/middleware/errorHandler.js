/**
 * Centralized Error Handling Middleware
 */
export const errorHandler = (err, req, res, next) => {
  const statusCode =
    err.statusCode || err.status || (res.statusCode >= 400 ? res.statusCode : 500);

  console.error(`[LogSentinel Backend Error] ${err.stack || err.message}`);

  const payload = {
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected error occurred.',
    timestamp: new Date().toISOString(),
  };

  if (process.env.NODE_ENV !== 'production' && err.stack) {
    payload.stack = err.stack;
  }

  res.status(statusCode).json(payload);
};
