import { ApiError } from './client';

/** i18n key for a failed API call. Backend error codes are listed in docs/api/*.md. */
export function errorMessageKey(e: unknown): string {
  if (!(e instanceof ApiError)) return 'errors.generic';
  switch (e.code) {
    case 'network_error':
      return 'errors.network';
    case 'timeout':
      return 'errors.timeout';
    case 'ai_busy':
      return 'errors.aiBusy';
    case 'ai_daily_limit':
      return 'errors.aiDailyLimit';
    case 'ai_declined':
      return 'errors.aiDeclined';
    case 'ai_unavailable':
    case 'ai_budget_exceeded':
    case 'ai_not_configured':
      return 'errors.aiUnavailable';
    case 'no_speech':
      return 'voice.noSpeech';
    case 'image_too_large':
    case 'unsupported_image':
    case 'image_required':
      return 'errors.badPhoto';
    case 'validation_error':
      return 'errors.invalidPhone';
    case 'otp_invalid':
      return 'errors.otpInvalid';
    case 'otp_expired':
      return 'errors.otpExpired';
    case 'otp_attempts_exceeded':
    case 'otp_cooldown':
    case 'otp_rate_limited':
      return 'errors.otpTooMany';
    default:
      return 'errors.generic';
  }
}
