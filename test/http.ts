export function extractCsrf(html: string): string {
  let m = html.match(/name="_csrf"[^>]*value="([^"]+)"/);
  if (!m) m = html.match(/value="([^"]+)"[^>]*name="_csrf"/);
  return m ? m[1] : '';
}

export function cookieFromResponse(res: Response): string {
  let sc = res.headers.get('Set-Cookie');
  if (!sc) return '';
  return sc.split(';')[0];
}