const BASE_API_URL = 'https://rest.gohighlevel.com/v1';

export type GoHighLevelConfig = {
  apiKey: string;
  calendarId: string;
  locationId: string;
  baseApiUrl: string;
  appointmentsApiUrl: string;
};

const requireEnv = (key: 'GOHIGHLEVEL_API_KEY' | 'GOHIGHLEVEL_CALENDAR_ID' | 'GOHIGHLEVEL_LOCATION_ID'): string => {
  const value = process.env[key];
  if (!value || value.trim().length === 0) {
    throw new Error(`[GHL Config] Missing required environment variable: ${key}`);
  }
  return value.trim();
};

export const getGoHighLevelConfig = (): GoHighLevelConfig => {
  const apiKey = requireEnv('GOHIGHLEVEL_API_KEY');
  const calendarId = requireEnv('GOHIGHLEVEL_CALENDAR_ID');
  const locationId = requireEnv('GOHIGHLEVEL_LOCATION_ID');

  return {
    apiKey,
    calendarId,
    locationId,
    baseApiUrl: BASE_API_URL,
    appointmentsApiUrl: `${BASE_API_URL}/appointments/`,
  };
};
