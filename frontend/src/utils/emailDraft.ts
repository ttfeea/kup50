import { LONG_MAILTO_BODY } from '../constants/emailTemplates';

export const MAILTO_LENGTH_LIMIT = 1800;

export function normalizeEmailAddress(input: string): string {
  const value = input.trim();
  const mailtoMatch = value.match(/mailto:([^)\s>]+)/i);

  if (mailtoMatch?.[1]) {
    return mailtoMatch[1].trim();
  }

  const angleBracketMatch = value.match(/<([^<>\s]+@[^<>\s]+)>/);
  if (angleBracketMatch?.[1]) {
    return angleBracketMatch[1].trim();
  }

  const emailMatch = value.match(
    /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  );

  return emailMatch?.[0] ?? value;
}

export function buildMailtoUrl(
  receiver: string,
  cc: string,
  subject: string,
  body: string,
): string {
  if (!receiver) {
    return '';
  }

  const ccParameter = cc ? `cc=${encodeURIComponent(cc)}&` : '';
  return `mailto:${receiver}?${ccParameter}subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function buildEmailDraftMailto(
  receiverInput: string,
  ccInput: string,
  subjectInput: string,
  bodyInput: string,
) {
  const receiver = normalizeEmailAddress(receiverInput);
  const cc = normalizeEmailAddress(ccInput);
  const subject = subjectInput ?? '';
  const body = (bodyInput ?? '').replace(/\r\n?/g, '\n');
  const fullMailtoUrl = buildMailtoUrl(receiver, cc, subject, body);
  const isTooLong = fullMailtoUrl.length > MAILTO_LENGTH_LIMIT;
  const mailtoUrl = isTooLong
    ? buildMailtoUrl(receiver, cc, subject, LONG_MAILTO_BODY)
    : fullMailtoUrl;

  return { receiver, cc, subject, body, mailtoUrl, isTooLong };
}
