import { afterEach, describe, expect, it } from 'vitest';
import { getGoHighLevelConfig } from '../lib/server/gohighlevel/config';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('getGoHighLevelConfig', () => {
  it('reads required values from environment variables', () => {
    process.env.GOHIGHLEVEL_API_KEY = 'test-api-key';
    process.env.GOHIGHLEVEL_CALENDAR_ID = 'cal-123';
    process.env.GOHIGHLEVEL_LOCATION_ID = 'loc-456';

    const config = getGoHighLevelConfig();

    expect(config.apiKey).toBe('test-api-key');
    expect(config.calendarId).toBe('cal-123');
    expect(config.locationId).toBe('loc-456');
    expect(config.baseApiUrl).toBe('https://rest.gohighlevel.com/v1');
    expect(config.appointmentsApiUrl).toBe('https://rest.gohighlevel.com/v1/appointments/');
  });

  it('throws clear error when GOHIGHLEVEL_CALENDAR_ID is missing', () => {
    process.env.GOHIGHLEVEL_API_KEY = 'test-api-key';
    delete process.env.GOHIGHLEVEL_CALENDAR_ID;
    process.env.GOHIGHLEVEL_LOCATION_ID = 'loc-456';

    expect(() => getGoHighLevelConfig()).toThrow(
      '[GHL Config] Missing required environment variable: GOHIGHLEVEL_CALENDAR_ID',
    );
  });
});
