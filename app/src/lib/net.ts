// All network calls go through here. Cookies are always off: the app never needs them,
// and with cookies on, Android loads the system WebView on a background thread for the
// first request, which crashes the app on some phones at launch.
export function request(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...init, credentials: 'omit' });
}
