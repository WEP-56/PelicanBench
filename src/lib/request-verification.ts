// Shared identifiers only. Signing secrets must remain on the server.
export const REQUEST_TOKEN_HEADER = "x-pelicanbench-request-token";
export const REQUEST_TOKEN_REJECTED = "REQUEST_VERIFICATION_FAILED";
export const REQUEST_TOKEN_PATH = "/api/request-token";

export type RequestToken = {
  token: string;
  expiresAt: number;
};
