export function browserLabel(ua: string | null): string {
  let value = ua ?? '';
  let browser = 'Unknown browser';
  if (/Edg\//.test(value)) browser = 'Edge';
  else if (/Chrome\//.test(value)) browser = 'Chrome';
  else if (/Firefox\//.test(value)) browser = 'Firefox';
  else if (/Safari\//.test(value)) browser = 'Safari';
  let os = 'Unknown OS';
  if (/Windows/.test(value)) os = 'Windows';
  else if (/Android/.test(value)) os = 'Android';
  else if (/iPhone|iPad/.test(value)) os = 'iOS';
  else if (/Mac OS X/.test(value)) os = 'macOS';
  else if (/Linux/.test(value)) os = 'Linux';
  return `${browser} on ${os}`;
}
