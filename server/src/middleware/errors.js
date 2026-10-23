const CLIENT_ERROR_MESSAGES = {
  400: "Bad request",
  413: "Request too large",
  415: "Unsupported media type",
};

export function notFound(_request, response) {
  response.status(404).json({ error: "Not found" });
}

function isClientError(error) {
  return Number.isInteger(error.status) && error.status >= 400 && error.status < 500;
}

export function createErrorHandler(logger) {
  // Express recognizes error handlers by their four parameters, so `next` must stay.
  // eslint-disable-next-line no-unused-vars
  return function handleError(error, request, response, next) {
    const context = { method: request.method, path: request.path };

    if (isClientError(error)) {
      logger.info("Rejected request", { ...context, status: error.status, type: error.type });
      const message = CLIENT_ERROR_MESSAGES[error.status] ?? CLIENT_ERROR_MESSAGES[400];
      response.status(error.status).json({ error: message });
      return;
    }

    logger.error("Request failed", { ...context, error });
    response.status(500).json({ error: "Something went wrong" });
  };
}
