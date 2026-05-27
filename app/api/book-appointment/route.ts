import { NextRequest, NextResponse } from 'next/server';
import { getGoHighLevelConfig } from '@/lib/server/gohighlevel/config';

const GHL_V2_BASE_URL = 'https://services.leadconnectorhq.com';
const CONTACTS_VERSION = '2021-07-28';
const CALENDAR_EVENTS_VERSION = '2021-04-15';
const DEFAULT_SLOT_DURATION_MINUTES = 60;

type GhlHttpResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  responseText: string;
};

function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  // Remove all non-digit characters except for a leading '+'
  let normalized = phone.replace(/[^+\d]/g, '');
  // If it doesn't start with +, and is a purely numeric local number, 
  // it might need a country code. This is a simplistic approach.
  // For GHL, E.164 format is often preferred (e.g., +1XXXXXXXXXX).
  // This basic normalization just cleans it up. More robust parsing might be needed.
  // For now, we just clean spaces and common symbols.
  normalized = phone.replace(/\s|-|\(|\)/g, ''); 
  return normalized;
}

function addMinutesToIsoTime(startTimeIso: string, minutes: number): string {
  const startMs = Date.parse(startTimeIso);
  if (Number.isNaN(startMs)) {
    throw new Error('Invalid selectedSlot format. Expected a valid ISO datetime string.');
  }

  return new Date(startMs + minutes * 60_000).toISOString();
}

async function sendGhlRequest(
  endpoint: string,
  version: string,
  apiKey: string,
  payload: Record<string, unknown>,
): Promise<GhlHttpResponse> {
  const response = await fetch(`${GHL_V2_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Version': version,
    },
    body: JSON.stringify(payload)
  });

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    responseText: await response.text(),
  };
}

function extractGhlErrorMessage(status: number, responseText: string): string {
  let errorMessage = `GHL API Error (${status})`;

  try {
    const errorData = JSON.parse(responseText) as {
      message?: string;
      msg?: string;
      error?: { message?: string } | string;
      errors?: Array<{ message?: string }>;
      [key: string]: unknown;
    };

    const maybeDirectMessage =
      errorData.message ||
      errorData.msg ||
      (typeof errorData.error === 'string' ? errorData.error : errorData.error?.message);

    if (maybeDirectMessage) {
      errorMessage = maybeDirectMessage;
    }

    if (errorData.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
      errorMessage += `: ${errorData.errors
        .map((err) => err.message || JSON.stringify(err))
        .join(', ')}`;
    }
  } catch {
    errorMessage += `: Failed to parse GHL error response. Raw text: ${responseText.substring(0, 200)}`;
  }

  return errorMessage;
}

function extractContactId(responseText: string): string | null {
  try {
    const parsed = JSON.parse(responseText) as {
      id?: string;
      contact?: { id?: string };
      data?: { id?: string; contact?: { id?: string } };
    };

    return parsed.contact?.id ?? parsed.data?.contact?.id ?? parsed.id ?? parsed.data?.id ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  console.log('[API /book-appointment] Received request');

  let config;
  try {
    config = getGoHighLevelConfig();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid GoHighLevel server configuration.' },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();
    console.log('[API /book-appointment] Request body:', body);
    const { firstName, lastName, email, phone, selectedSlot, selectedTimezone } = body;
    const trimmedFirstName = typeof firstName === 'string' ? firstName.trim() : '';
    const trimmedLastName = typeof lastName === 'string' ? lastName.trim() : '';
    const trimmedEmail = typeof email === 'string' ? email.trim() : '';

    if (!trimmedFirstName || !trimmedLastName || !trimmedEmail || !selectedSlot || !selectedTimezone) {
      console.error('[API /book-appointment] Validation Error: Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: firstName, lastName, email, selectedSlot, and selectedTimezone are required' },
        { status: 400 } // Bad Request for client error
      );
    }

    const normalizedPhone = phone ? normalizePhoneNumber(phone) : undefined;
    const endTime = addMinutesToIsoTime(selectedSlot, DEFAULT_SLOT_DURATION_MINUTES);

    const contactPayload: Record<string, unknown> = {
      locationId: config.locationId,
      firstName: trimmedFirstName,
      lastName: trimmedLastName,
      email: trimmedEmail,
    };

    if (normalizedPhone) {
      contactPayload.phone = normalizedPhone;
    }

    if (normalizedPhone) {
      console.log(`[API /book-appointment] Normalized phone: ${phone} -> ${normalizedPhone}`);
    }

    console.log('[API /book-appointment] Upserting contact in GHL v2 with payload:', contactPayload);
    const upsertResponse = await sendGhlRequest('/contacts/upsert', CONTACTS_VERSION, config.apiKey, contactPayload);
    console.log(`[API /book-appointment] GHL contact upsert status: ${upsertResponse.status}`);
    console.log('[API /book-appointment] GHL contact upsert raw response:', upsertResponse.responseText);

    if (!upsertResponse.ok) {
      const errorMessage = extractGhlErrorMessage(upsertResponse.status, upsertResponse.responseText);
      return NextResponse.json({ error: errorMessage }, { status: upsertResponse.status });
    }

    const contactId = extractContactId(upsertResponse.responseText);
    if (!contactId) {
      return NextResponse.json(
        { error: 'GHL contact upsert succeeded but no contactId was returned.' },
        { status: 502 },
      );
    }

    const appointmentPayload: Record<string, unknown> = {
      calendarId: config.calendarId,
      locationId: config.locationId,
      contactId,
      startTime: selectedSlot,
      endTime,
      appointmentStatus: 'confirmed',
      selectedTimezone,
    };

    console.log('[API /book-appointment] Creating appointment in GHL v2 with payload:', appointmentPayload);
    const appointmentResponse = await sendGhlRequest('/calendars/events/appointments', CALENDAR_EVENTS_VERSION, config.apiKey, appointmentPayload);
    const responseText = appointmentResponse.responseText;
    console.log(`[API /book-appointment] GHL appointment create status: ${appointmentResponse.status}`);
    console.log('[API /book-appointment] GHL appointment create raw response:', responseText);

    if (!appointmentResponse.ok) {
      console.error('[API /book-appointment] GHL API Error Details:', {
        status: appointmentResponse.status,
        statusText: appointmentResponse.statusText,
        responseText
      });
      const errorMessage = extractGhlErrorMessage(appointmentResponse.status, responseText);
       // Return GHL's status code if it's a 4xx or 5xx client/server error from their end
      return NextResponse.json(
        { error: errorMessage },
        { status: appointmentResponse.status } // Use GHL's status for more direct feedback
      );
    }

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      console.warn('[API /book-appointment] Successfully booked but failed to parse GHL JSON response. Raw text:', responseText.substring(0,500));
      responseData = { success: true, message: 'Appointment booked (GHL response not standard JSON)', rawResponse: responseText };
    }

    console.log('[API /book-appointment] Appointment booked successfully via GHL. Parsed Response:', responseData);
    return NextResponse.json({
      success: true,
      data: responseData,
      appointmentDetails: { // Return what was attempted for confirmation UI
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        email: trimmedEmail,
        phone: normalizedPhone,
        selectedSlot,
        selectedTimezone
      }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error during booking process';
    console.error('[API /book-appointment] Internal Server Error:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
