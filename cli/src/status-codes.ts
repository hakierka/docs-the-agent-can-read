/** Known HTTP status codes that have an image on https://http.cat. */
export interface StatusEntry {
  code: number;
  reason: string;
  /**
   * True when the code is not an IANA-registered HTTP status.
   * `product` names the vendor whose docs define the meaning.
   */
  nonStandard?: boolean;
  product?: string;
}

/**
 * Static table: codes with http.cat images + reason phrases.
 * Standard reasons from IANA / MDN. Non-standard codes only when a
 * product documents them (Laravel, nginx, Cloudflare) — never folk names.
 *
 * Allowlist last verified with polite HEAD requests against http.cat on 2026-10-21.
 */
export const STATUS_CODES: readonly StatusEntry[] = [
  { code: 100, reason: "Continue" },
  { code: 101, reason: "Switching Protocols" },
  { code: 102, reason: "Processing" },
  { code: 103, reason: "Early Hints" },
  { code: 200, reason: "OK" },
  { code: 201, reason: "Created" },
  { code: 202, reason: "Accepted" },
  { code: 203, reason: "Non-Authoritative Information" },
  { code: 204, reason: "No Content" },
  { code: 205, reason: "Reset Content" },
  { code: 206, reason: "Partial Content" },
  { code: 207, reason: "Multi-Status" },
  { code: 208, reason: "Already Reported" },
  { code: 226, reason: "IM Used" },
  { code: 300, reason: "Multiple Choices" },
  { code: 301, reason: "Moved Permanently" },
  { code: 302, reason: "Found" },
  { code: 303, reason: "See Other" },
  { code: 304, reason: "Not Modified" },
  { code: 305, reason: "Use Proxy" },
  { code: 307, reason: "Temporary Redirect" },
  { code: 308, reason: "Permanent Redirect" },
  { code: 400, reason: "Bad Request" },
  { code: 401, reason: "Unauthorized" },
  { code: 402, reason: "Payment Required" },
  { code: 403, reason: "Forbidden" },
  { code: 404, reason: "Not Found" },
  { code: 405, reason: "Method Not Allowed" },
  { code: 406, reason: "Not Acceptable" },
  { code: 407, reason: "Proxy Authentication Required" },
  { code: 408, reason: "Request Timeout" },
  { code: 409, reason: "Conflict" },
  { code: 410, reason: "Gone" },
  { code: 411, reason: "Length Required" },
  { code: 412, reason: "Precondition Failed" },
  { code: 413, reason: "Content Too Large" },
  { code: 414, reason: "URI Too Long" },
  { code: 415, reason: "Unsupported Media Type" },
  { code: 416, reason: "Range Not Satisfiable" },
  { code: 417, reason: "Expectation Failed" },
  { code: 418, reason: "I'm a teapot" },
  // Laravel CSRF mismatch — https://laravel.com/docs/csrf (non-standard)
  { code: 419, reason: "Page Expired", nonStandard: true, product: "Laravel" },
  { code: 421, reason: "Misdirected Request" },
  { code: 422, reason: "Unprocessable Content" },
  { code: 423, reason: "Locked" },
  { code: 424, reason: "Failed Dependency" },
  { code: 425, reason: "Too Early" },
  { code: 426, reason: "Upgrade Required" },
  { code: 428, reason: "Precondition Required" },
  { code: 429, reason: "Too Many Requests" },
  { code: 431, reason: "Request Header Fields Too Large" },
  // nginx return — closes connection without a response header (non-standard)
  { code: 444, reason: "No Response", nonStandard: true, product: "nginx" },
  { code: 451, reason: "Unavailable For Legal Reasons" },
  // nginx internal SSL / scheme codes (non-standard)
  { code: 495, reason: "SSL Certificate Error", nonStandard: true, product: "nginx" },
  { code: 496, reason: "SSL Certificate Required", nonStandard: true, product: "nginx" },
  { code: 497, reason: "HTTP Request Sent to HTTPS Port", nonStandard: true, product: "nginx" },
  // nginx NGX_HTTP_CLIENT_CLOSED_REQUEST (non-standard)
  { code: 499, reason: "Client Closed Request", nonStandard: true, product: "nginx" },
  { code: 500, reason: "Internal Server Error" },
  { code: 501, reason: "Not Implemented" },
  { code: 502, reason: "Bad Gateway" },
  { code: 503, reason: "Service Unavailable" },
  { code: 504, reason: "Gateway Timeout" },
  // 505 has no http.cat image — checked against http.cat on 2026-10-21 (HEAD → HTTP 404)
  { code: 506, reason: "Variant Also Negotiates" },
  { code: 507, reason: "Insufficient Storage" },
  { code: 508, reason: "Loop Detected" },
  { code: 510, reason: "Not Extended" },
  { code: 511, reason: "Network Authentication Required" },
  // Cloudflare 5xx — https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/
  { code: 521, reason: "Web Server Is Down", nonStandard: true, product: "Cloudflare" },
  { code: 522, reason: "Connection Timed Out", nonStandard: true, product: "Cloudflare" },
  { code: 523, reason: "Origin Is Unreachable", nonStandard: true, product: "Cloudflare" },
  { code: 525, reason: "SSL Handshake Failed", nonStandard: true, product: "Cloudflare" },
] as const;

/**
 * IANA-registered status codes (and RFC 2324 teapot) used when a real HTTP
 * status is in range but has no entry in STATUS_CODES / no http.cat image.
 */
const IANA_REASONS: ReadonlyMap<number, string> = new Map([
  [100, "Continue"],
  [101, "Switching Protocols"],
  [102, "Processing"],
  [103, "Early Hints"],
  [200, "OK"],
  [201, "Created"],
  [202, "Accepted"],
  [203, "Non-Authoritative Information"],
  [204, "No Content"],
  [205, "Reset Content"],
  [206, "Partial Content"],
  [207, "Multi-Status"],
  [208, "Already Reported"],
  [226, "IM Used"],
  [300, "Multiple Choices"],
  [301, "Moved Permanently"],
  [302, "Found"],
  [303, "See Other"],
  [304, "Not Modified"],
  [305, "Use Proxy"],
  [306, "(Unused)"],
  [307, "Temporary Redirect"],
  [308, "Permanent Redirect"],
  [400, "Bad Request"],
  [401, "Unauthorized"],
  [402, "Payment Required"],
  [403, "Forbidden"],
  [404, "Not Found"],
  [405, "Method Not Allowed"],
  [406, "Not Acceptable"],
  [407, "Proxy Authentication Required"],
  [408, "Request Timeout"],
  [409, "Conflict"],
  [410, "Gone"],
  [411, "Length Required"],
  [412, "Precondition Failed"],
  [413, "Content Too Large"],
  [414, "URI Too Long"],
  [415, "Unsupported Media Type"],
  [416, "Range Not Satisfiable"],
  [417, "Expectation Failed"],
  [418, "I'm a teapot"],
  [421, "Misdirected Request"],
  [422, "Unprocessable Content"],
  [423, "Locked"],
  [424, "Failed Dependency"],
  [425, "Too Early"],
  [426, "Upgrade Required"],
  [428, "Precondition Required"],
  [429, "Too Many Requests"],
  [431, "Request Header Fields Too Large"],
  [451, "Unavailable For Legal Reasons"],
  [500, "Internal Server Error"],
  [501, "Not Implemented"],
  [502, "Bad Gateway"],
  [503, "Service Unavailable"],
  [504, "Gateway Timeout"],
  [505, "HTTP Version Not Supported"],
  [506, "Variant Also Negotiates"],
  [507, "Insufficient Storage"],
  [508, "Loop Detected"],
  [510, "Not Extended"],
  [511, "Network Authentication Required"],
]);

const BY_CODE = new Map(STATUS_CODES.map((e) => [e.code, e]));

export type StatusClass = "1xx" | "2xx" | "3xx" | "4xx" | "5xx";

export function getStatus(code: number): StatusEntry | undefined {
  return BY_CODE.get(code);
}

export function isKnownCode(code: number): boolean {
  return BY_CODE.has(code);
}

/** IANA/MDN reason for a registered HTTP status, if any. */
export function getIanaReason(code: number): string | undefined {
  return IANA_REASONS.get(code);
}

export function listByClass(statusClass?: StatusClass): readonly StatusEntry[] {
  if (!statusClass) return STATUS_CODES;
  const digit = Number(statusClass[0]);
  return STATUS_CODES.filter((e) => Math.floor(e.code / 100) === digit);
}

export function formatListLine(entry: StatusEntry): string {
  const base = `${entry.code} ${entry.reason}`;
  if (entry.nonStandard && entry.product) {
    return `${base} (non-standard, ${entry.product})`;
  }
  return base;
}

export function imageUrl(code: number): string {
  return `https://http.cat/${code}`;
}
