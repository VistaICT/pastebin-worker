import Validator from 'validatorjs';

export type SingleEmailValidationError = 'required' | 'multiple' | 'invalid';

const VALIDATION_LANG = 'en';

Validator.setMessages(VALIDATION_LANG, {
  required: 'required',
  email: 'invalid',
  def: 'invalid',
});
Validator.useLang(VALIDATION_LANG);

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function validateSingleEmail(value: string): SingleEmailValidationError | null {
  const trimmed = value.trim();
  if (!trimmed) return 'required';
  if (trimmed.includes(',') || trimmed.includes(';')) return 'multiple';

  const validation = new Validator(
    { email: trimmed },
    { email: 'required|email' },
  );
  validation.setAttributeNames({ email: 'email' });

  try {
    if (validation.fails()) return 'invalid';
  } catch {
    // Some validatorjs browser bundles can throw during message template rendering.
    // Treat unexpected validator failures as invalid input instead of crashing the UI.
    return 'invalid';
  }

  return null;
}

export function isValidSingleEmail(value: string): boolean {
  return validateSingleEmail(value) === null;
}