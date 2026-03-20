export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function getSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function buildRedirectUrl(
  redirectTo: string,
  type: "message" | "error",
  value: string,
) {
  const url = new URL(redirectTo, "http://localhost");
  url.searchParams.set(type, value);
  return `${url.pathname}${url.search}`;
}
