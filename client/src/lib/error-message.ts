type ApiErrorShape = { data?: { httpStatus?: number } | null };

export function httpStatusOf(error: unknown): number | undefined {
  return (error as ApiErrorShape | null | undefined)?.data?.httpStatus;
}

/** The server's message for expected failures. Crashes and outages get a generic one, so they never look like user error. */
export function errorMessage(error: unknown): string {
  const status = httpStatusOf(error);
  if (error instanceof Error && status !== undefined && status < 500) return error.message;
  return "Something went wrong. Please try again.";
}

/** The server understood the request and said no, as opposed to crashing or being unreachable. */
export function isRejection(error: unknown): boolean {
  const status = httpStatusOf(error);
  return status !== undefined && status < 500;
}
