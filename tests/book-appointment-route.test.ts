import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../app/api/book-appointment/route';

type FetchCall = [RequestInfo | URL, RequestInit?];
type ContactPayload = { phone?: string; firstName?: string; lastName?: string; email?: string; locationId?: string };
type AppointmentPayload = {
  calendarId?: string;
  locationId?: string;
  contactId?: string;
  startTime?: string;
  endTime?: string;
  selectedTimezone?: string;
  appointmentStatus?: string;
};

const ORIGINAL_ENV = { ...process.env };

const buildRequest = (body: Record<string, string>): NextRequest =>
  new NextRequest('http://localhost:3000/api/book-appointment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('POST /api/book-appointment', () => {
  it('upserts contact then creates appointment in GHL v2 while preserving response details', async () => {
    process.env.GOHIGHLEVEL_API_KEY = 'test-api-key';
    process.env.GOHIGHLEVEL_CALENDAR_ID = 'cal-123';
    process.env.GOHIGHLEVEL_LOCATION_ID = 'loc-456';

    const fetchMock = vi
      .fn<FetchCall, Promise<Response>>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ contact: { id: 'contact-321' } }), {
          status: 200,
          statusText: 'OK',
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'appt-123' }), {
          status: 200,
          statusText: 'OK',
        }),
      );

    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(
      buildRequest({
        firstName: ' Anas ',
        lastName: ' Najoui ',
        email: ' anasnajoui2001@gmail.com ',
        phone: '0636052325',
        selectedSlot: '2026-04-05T09:00:00.000Z',
        selectedTimezone: 'Europe/Rome',
      }),
    );
    const responseBody = await response.json();

    expect(response.status).toBe(200);
    expect(responseBody.success).toBe(true);
    expect(responseBody.appointmentDetails.firstName).toBe('Anas');
    expect(responseBody.appointmentDetails.lastName).toBe('Najoui');
    expect(responseBody.appointmentDetails.email).toBe('anasnajoui2001@gmail.com');
    expect(responseBody.appointmentDetails.phone).toBe('0636052325');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const contactPayload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as ContactPayload;
    const appointmentPayload = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as AppointmentPayload;

    expect(contactPayload.firstName).toBe('Anas');
    expect(contactPayload.lastName).toBe('Najoui');
    expect(contactPayload.email).toBe('anasnajoui2001@gmail.com');
    expect(contactPayload.phone).toBe('0636052325');
    expect(contactPayload.locationId).toBe('loc-456');

    expect(appointmentPayload.calendarId).toBe('cal-123');
    expect(appointmentPayload.locationId).toBe('loc-456');
    expect(appointmentPayload.contactId).toBe('contact-321');
    expect(appointmentPayload.startTime).toBe('2026-04-05T09:00:00.000Z');
    expect(appointmentPayload.endTime).toBe('2026-04-05T10:00:00.000Z');
    expect(appointmentPayload.selectedTimezone).toBe('Europe/Rome');
    expect(appointmentPayload.appointmentStatus).toBe('new');
  });

  it('returns 502 when contact upsert succeeds without contact id', async () => {
    process.env.GOHIGHLEVEL_API_KEY = 'test-api-key';
    process.env.GOHIGHLEVEL_CALENDAR_ID = 'cal-123';
    process.env.GOHIGHLEVEL_LOCATION_ID = 'loc-456';

    const fetchMock = vi
      .fn<FetchCall, Promise<Response>>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          statusText: 'OK',
        }),
      );

    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(
      buildRequest({
        firstName: 'Anas',
        lastName: 'Najoui',
        email: 'anasnajoui2001@gmail.com',
        phone: '0636052325',
        selectedSlot: '2026-04-05T09:00:00.000Z',
        selectedTimezone: 'Europe/Rome',
      }),
    );
    const responseBody = await response.json();

    expect(response.status).toBe(502);
    expect(responseBody.error).toContain('no contactId');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
