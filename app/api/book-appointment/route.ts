import { NextRequest, NextResponse } from 'next/server';
import { getGoHighLevelConfig } from '@/lib/server/gohighlevel/config';
import { buildAppointmentPayload } from '@/lib/server/gohighlevel/request';

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
    const { email, phone, selectedSlot, selectedTimezone } = body;

    if (!email || !selectedSlot || !selectedTimezone) {
      console.error('[API /book-appointment] Validation Error: Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: email, selectedSlot, and selectedTimezone are required' },
        { status: 400 } // Bad Request for client error
      );
    }

    const normalizedPhone = phone ? normalizePhoneNumber(phone) : undefined;
    const ghlData = buildAppointmentPayload(
      {
        selectedTimezone,
        selectedSlot,
        email,
        phone: normalizedPhone,
      },
      config,
    );

    if (normalizedPhone) {
      console.log(`[API /book-appointment] Normalized phone: ${phone} -> ${normalizedPhone}`);
    }

    console.log('[API /book-appointment] Sending data to GHL:', ghlData);

    const ghlResponse = await fetch(config.appointmentsApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(ghlData)
    });

    const responseText = await ghlResponse.text(); // Get text first for better error logging
    console.log(`[API /book-appointment] GHL Raw Response Status: ${ghlResponse.status}`);
    console.log('[API /book-appointment] GHL Raw Response Text:', responseText);

    if (!ghlResponse.ok) {
      console.error('[API /book-appointment] GHL API Error Details:', {
        status: ghlResponse.status,
        statusText: ghlResponse.statusText,
        responseText
      });
      let errorMessage = `GHL API Error (${ghlResponse.status})`;
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.message || errorData.error?.message || (typeof errorData.error === 'string' ? errorData.error : errorMessage);
        if (errorData.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
           errorMessage += `: ${errorData.errors
             .map((err: { message?: string }) => err.message || JSON.stringify(err))
             .join(', ')}`;
        }
      } catch {
         errorMessage += ': Failed to parse GHL error response. Raw text: ' + responseText.substring(0, 200);
      }
       // Return GHL's status code if it's a 4xx or 5xx client/server error from their end
      return NextResponse.json(
        { error: errorMessage },
        { status: ghlResponse.status } // Use GHL's status for more direct feedback
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
        email,
        phone: ghlData.phone, // Send back the normalized phone
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
