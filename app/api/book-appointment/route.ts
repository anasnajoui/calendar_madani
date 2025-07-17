import { NextRequest, NextResponse } from 'next/server';

// Configuration for GoHighLevel
const GHL_CONFIG = {
  calendarId: 'PodafRddcOf4U8b0zAeE',
  locationId: 's5MRQQ7j3TjZXRe0CtvE',
  apiKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJsb2NhdGlvbl9pZCI6InM1TVJRUTdqM1RqWlhSZTBDdHZFIiwiY29tcGFueV9pZCI6IkR0anBxVUZmaHZyNlJIak9WcWR6IiwidmVyc2lvbiI6MSwiaWF0IjoxNjkxOTUwNTEzMjg4LCJzdWIiOiJ4TVZiOHVTVHNvTTkzNjNFbW1ubyJ9.aexZGVFaqG_L6n3VPzP7xdZIiyqKp8-6nEi3HZWQ7jI',
  apiEndpoint: 'https://rest.gohighlevel.com/v1/appointments/'
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

export async function POST(request: NextRequest) {
  console.log('[API /book-appointment] Received request');
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

    const ghlData: {
      calendarId: string;
      selectedTimezone: string;
      selectedSlot: string;
      email: string;
      phone?: string;
      // Consider adding other optional fields if GHL supports/requires them for your use case
      // e.g., firstName, lastName (can be derived from email or a name field if you add one)
    } = {
      calendarId: GHL_CONFIG.calendarId,
      selectedTimezone: selectedTimezone,
      selectedSlot: selectedSlot,
      email: email
    };

    if (phone) {
      ghlData.phone = normalizePhoneNumber(phone);
      console.log(`[API /book-appointment] Normalized phone: ${phone} -> ${ghlData.phone}`);
    }

    console.log('[API /book-appointment] Sending data to GHL:', ghlData);

    const ghlResponse = await fetch(GHL_CONFIG.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GHL_CONFIG.apiKey}`
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
           errorMessage += `: ${errorData.errors.map((err: any) => err.message || JSON.stringify(err)).join(', ')}`;
        }
      } catch (parseError) {
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
    } catch (parseError) {
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

  } catch (error: any) {
    console.error('[API /book-appointment] Internal Server Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error during booking process' },
      { status: 500 }
    );
  }
} 
