import { describe, expect, it } from 'vitest';
import { buildAppointmentPayload, getProxyParams } from '../lib/server/gohighlevel/request';
import type { GoHighLevelConfig } from '../lib/server/gohighlevel/config';

const config: GoHighLevelConfig = {
  apiKey: 'test-api-key',
  calendarId: 'cal-env',
  locationId: 'loc-env',
  baseApiUrl: 'https://rest.gohighlevel.com/v1',
  appointmentsApiUrl: 'https://rest.gohighlevel.com/v1/appointments/',
};

describe('getProxyParams', () => {
  it('forces server-owned calendar and location for appointments/slots', () => {
    const params = getProxyParams(
      'appointments/slots',
      {
        calendarId: 'client-calendar',
        locationId: 'client-location',
        timezone: 'Europe/Rome',
        startDate: '1735689600000',
      },
      config,
    );

    expect(params.calendarId).toBe('cal-env');
    expect(params.locationId).toBe('loc-env');
    expect(params.timezone).toBe('Europe/Rome');
  });

  it('keeps original params for non-slot endpoints', () => {
    const params = getProxyParams(
      'contacts',
      {
        calendarId: 'client-calendar',
      },
      config,
    );

    expect(params.calendarId).toBe('client-calendar');
  });
});

describe('buildAppointmentPayload', () => {
  it('builds booking payload from server env values', () => {
    const payload = buildAppointmentPayload(
      {
        selectedTimezone: 'Europe/Rome',
        selectedSlot: '2026-04-05T09:00:00.000Z',
        email: 'test@example.com',
        phone: '+393331112223',
      },
      config,
    );

    expect(payload.calendarId).toBe('cal-env');
    expect(payload.locationId).toBe('loc-env');
    expect(payload.selectedTimezone).toBe('Europe/Rome');
    expect(payload.email).toBe('test@example.com');
    expect(payload.phone).toBe('+393331112223');
  });

  it('omits phone when not provided', () => {
    const payload = buildAppointmentPayload(
      {
        selectedTimezone: 'Europe/Rome',
        selectedSlot: '2026-04-05T09:00:00.000Z',
        email: 'test@example.com',
      },
      config,
    );

    expect(payload.phone).toBeUndefined();
  });
});
