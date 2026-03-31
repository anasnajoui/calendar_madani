import { GoHighLevelConfig } from './config';

type QueryParams = Record<string, string>;

export const getProxyParams = (
  endpoint: string,
  clientParams: QueryParams,
  config: GoHighLevelConfig,
): QueryParams => {
  if (endpoint === 'appointments/slots') {
    return {
      ...clientParams,
      calendarId: config.calendarId,
      locationId: config.locationId,
    };
  }

  return clientParams;
};

export const buildAppointmentPayload = (
  input: {
    selectedTimezone: string;
    selectedSlot: string;
    email: string;
    phone?: string;
  },
  config: GoHighLevelConfig,
): {
  calendarId: string;
  locationId: string;
  selectedTimezone: string;
  selectedSlot: string;
  email: string;
  phone?: string;
} => {
  const payload = {
    calendarId: config.calendarId,
    locationId: config.locationId,
    selectedTimezone: input.selectedTimezone,
    selectedSlot: input.selectedSlot,
    email: input.email,
    phone: input.phone,
  };

  if (!payload.phone) {
    delete payload.phone;
  }

  return payload;
};
