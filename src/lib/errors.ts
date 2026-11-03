export function getErrorDigest(error: unknown) {
  if (
    error instanceof Error &&
    "digest" in error &&
    typeof error.digest === "string"
  ) {
    return error.digest
  }
  return undefined
}
