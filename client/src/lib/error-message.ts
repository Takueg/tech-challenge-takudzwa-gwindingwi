type ApiErrorShape = { data?: { httpStatus?: number } | null };

/** The server's message for expected failures. Crashes and outages get a generic one, so they never look like user error. */
export function errorMessage(error: unknown): string {
  const status = (error as ApiErrorShape | null | undefined)?.data?.httpStatus;
  if (error instanceof Error && status !== undefined && status < 500) return error.message;
  return "Something went wrong. Please try again.";
}
