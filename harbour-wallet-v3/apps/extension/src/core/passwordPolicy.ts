import commonPasswords from './commonPasswords.json';

// Target policy: REA onboarding pass / useValidatePassword-Dn2iwOd-.js.
// This list is public validation data, never stored user credentials.
export function validatePassword(value: string): { valid: boolean; error?: string } {
  if (!value) return { valid: false };
  if (value.length < 8) return { valid: false, error: 'Min 8 characters' };
  if (value.length > 64) return { valid: false, error: 'Password is too long' };
  if (commonPasswords.includes(value)) return { valid: false, error: 'This password is too common. Try something more unique.' };
  return { valid: true };
}
