// Write a message for the person (polite / formal / friendly, Bangla or English),
// then hand it to WhatsApp or SMS. The person always presses send themselves.

export type Tone = 'polite' | 'formal' | 'friendly';

/** Bangladesh numbers: 01XXXXXXXXX → 8801XXXXXXXXX. Others are kept as digits. */
export function intlPhone(raw: string): string {
  let d = raw.replace(/[^\d]/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (/^01\d{9}$/.test(d)) d = '88' + d;
  return d;
}

export function whatsappUrl(phone: string, text: string): string {
  const p = intlPhone(phone);
  return p ? `https://wa.me/${p}?text=${encodeURIComponent(text)}` : `whatsapp://send?text=${encodeURIComponent(text)}`;
}

export function smsUrl(phone: string, text: string): string {
  return `sms:${phone.replace(/[^\d+]/g, '')}?body=${encodeURIComponent(text)}`;
}

