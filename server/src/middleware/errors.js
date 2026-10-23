export function notFound(_request, response) {
  response.status(404).json({ error: "Not found" });
}

export function createErrorHandler(logger) {
  // Express recognizes error handlers by their four parameters, so `next` must stay.
  // eslint-disable-next-line no-unused-vars
  return function handleError(error, request, response, next) {
    logger.error("Request failed", { method: request.method, path: request.path, error });
    response.status(500).json({ error: "Something went wrong" });
  };
}
