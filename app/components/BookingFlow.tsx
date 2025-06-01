'use client';

import React, { useState, useRef, useEffect } from 'react';
import { format, addDays, isSameDay, isToday, isAfter, startOfDay, parseISO, differenceInMinutes, setHours, setMinutes, setSeconds, setMilliseconds, endOfDay, addMinutes, getHours } from 'date-fns';
import { it } from 'date-fns/locale';

// Configuration for GoHighLevel Calendar
const GHL_CALENDAR_ID = 'pybJlTCxAZU1k1w3W5V7';
const DEFAULT_SLOT_DURATION_MINUTES = 60; // All slots are now considered 60 minutes

interface TimeSlot {
  start: string; // ISO string for start time
  end: string;   // ISO string for end time
  displayTime: string; // Formatted time for UI, e.g., "9:00 AM"
}

interface AppointmentDetails {
  date: string;
  time: string; // This will now likely be the ISO start time string
  email: string;
  phone: string;
}

export default function BookingFlow() {
  const [currentStep, setCurrentStep] = useState('preference');
  const [selectedPreference, setSelectedPreference] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null); // Stores ISO start time
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [appointmentDetails, setAppointmentDetails] = useState<AppointmentDetails | null>(null);
  const datesContainerRef = useRef<HTMLDivElement>(null);

  // State for auto-finding date with slots
  const [isAutoFindingDate, setIsAutoFindingDate] = useState(false);
  const [autoFindDateAttempt, setAutoFindDateAttempt] = useState(0);
  const didAutoFindJustCompleteRef = useRef(false);

  // State for booking process
  const [isBooking, setIsBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  useEffect(() => {
    console.log(`[BookingFlow Effect] isBooking state changed to: ${isBooking}. Current step: ${currentStep}`);
  }, [isBooking, currentStep]);

  useEffect(() => {
    console.log(`[BookingFlow Effect] currentStep state changed to: ${currentStep}. isBooking state: ${isBooking}`);
  }, [currentStep, isBooking]);

  // Generate dates for the next 14 days
  const generateDates = () => {
    const dates = [];
    for (let i = 0; i < 14; i++) {
      dates.push(addDays(new Date(), i));
    }
    return dates;
  };

  // Format date for display (e.g., "Lun 27 Nov")
  const formatDateForDisplay = (date: Date) => {
    return format(date, 'EEE d MMM', { locale: it });
  };

  // Auto-select the closest available date
  const autoSelectClosestDate = () => {
    const dates = generateDates();
    const today = startOfDay(new Date());
    
    const firstAvailableDate = dates.find(date => 
      isAfter(startOfDay(date), today) || isSameDay(startOfDay(date), today)
    ) || dates[0]; 
    
    setSelectedDate(firstAvailableDate);
    return firstAvailableDate;
  };

  // Internal function to fetch and process slots, returns TimeSlot[]
  const fetchGHLCalendarSlotsInternal = async (date: Date): Promise<TimeSlot[]> => {
    if (!date) return [];
    
    const queryStartDate = startOfDay(date).getTime();
    const queryEndDate = endOfDay(date).getTime();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const ghlEndpoint = 'appointments/slots';
    const apiUrl = `/api/gohighlevel?endpoint=${ghlEndpoint}&calendarId=${GHL_CALENDAR_ID}&startDate=${queryStartDate}&endDate=${queryEndDate}&timezone=${encodeURIComponent(timezone)}`;
    
    console.log('[BookingFlow] Fetching GHL slots (internal). URL:', apiUrl);

    try {
      const response = await fetch(apiUrl);
      const responseText = await response.text();
      console.log('[BookingFlow] GHL Raw Response Text (internal):', responseText);

      if (!response.ok) {
        console.error('[BookingFlow] Error fetching GHL slots (internal). Status:', response.status, 'Response:', responseText);
        return [];
      }

      let data;
      try {
        data = JSON.parse(responseText);
        console.log('[BookingFlow] GHL Parsed JSON Data (internal):', data);
      } catch (parseError) {
        console.error('[BookingFlow] Error parsing GHL response as JSON (internal):', parseError, 'Raw text was:', responseText);
        return [];
      }
      
      let fetchedSlotStrings: string[] = [];
      const dateKey = format(date, 'yyyy-MM-dd'); 

      if (data && typeof data === 'object' && data !== null && data[dateKey] && typeof data[dateKey] === 'object' && data[dateKey] !== null && Array.isArray(data[dateKey].slots)) {
        fetchedSlotStrings = data[dateKey].slots.filter((s: any) => typeof s === 'string');
        console.log(`[BookingFlow] Extracted ${fetchedSlotStrings.length} slot strings from data['${dateKey}'].slots (internal)`);
      } else {
        if (Object.keys(data || {}).length > 0 && JSON.stringify(data) !== '{}') { 
             console.warn('[BookingFlow] Could not find slots in primary structure (internal). Data:', JSON.stringify(data, null, 2));
        } else {
             console.log('[BookingFlow] GHL Data received is empty or not in a recognized slot format (internal).');
        }
        return []; // Return empty if primary structure not found
      }

      // Sort the fetched slot strings (start times) chronologically
      fetchedSlotStrings.sort((a, b) => parseISO(a).getTime() - parseISO(b).getTime());

      const processedSlots: TimeSlot[] = fetchedSlotStrings
        .map((slotISOString: string) => {
          try {
            const slotStartDateTime = parseISO(slotISOString);
            // All slots will now have a fixed duration of DEFAULT_SLOT_DURATION_MINUTES (60 minutes)
            const slotEndDateTime = addMinutes(slotStartDateTime, DEFAULT_SLOT_DURATION_MINUTES);

            return {
              start: slotISOString,
              end: slotEndDateTime.toISOString(),
              displayTime: format(slotStartDateTime, 'HH:mm', { locale: it }),
            };
          } catch (e) {
            console.error(`[BookingFlow] Error parsing slot string or calculating end time (internal): ${slotISOString}`, e);
            return null; 
          }
        })
        .filter(slot => slot !== null) as TimeSlot[];
      
      if (processedSlots.length > 0) {
          console.log(`[BookingFlow] Successfully processed ${processedSlots.length} fixed-duration (60min) slots (internal). First slot:`, processedSlots[0]);
      }
      return processedSlots;
    } catch (error) {
      console.error('[BookingFlow] Failed to fetch or process GHL slots (internal):', error);
      return [];
    }
  };

  // Fetches and sets slots for a given date (usually for manual date selection)
  const fetchAndSetSlotsForDate = async (date: Date) => {
    if (!date) return;
    setIsLoadingSlots(true);
    setAvailableSlots([]); 
    const slots = await fetchGHLCalendarSlotsInternal(date);
    setAvailableSlots(slots);
    setIsLoadingSlots(false);
  };

  const filterSlotsByPreference = (slots: TimeSlot[], preference: string | null): TimeSlot[] => {
    if (!preference) return slots; // Return all if no preference
    return slots.filter(slot => {
        const slotDate = parseISO(slot.start);
        const hour = getHours(slotDate); // Use getHours from date-fns
        if (preference === 'morning') {
            return hour >= 8 && hour < 13; // 8:00 AM to 12:59 PM
        } else if (preference === 'afternoon') {
            return hour >= 13 && hour < 18; // 1:00 PM to 5:59 PM
        }
        return true; // Should not happen if preference is 'morning' or 'afternoon'
    });
  };

  // Effect to fetch slots when selectedDate changes (for manual selection)
  useEffect(() => {
    if (selectedDate && !isAutoFindingDate && !didAutoFindJustCompleteRef.current) {
      fetchAndSetSlotsForDate(selectedDate);
    }
    if (didAutoFindJustCompleteRef.current) {
        didAutoFindJustCompleteRef.current = false; // Reset the flag
    }
  }, [selectedDate, isAutoFindingDate]);

  // Effect for auto-finding the first available date/slot (optimized to stop on first match)
  useEffect(() => {
    if (!isAutoFindingDate || !selectedPreference) return;

    const findAndSetParallel = async () => {
      const datesToSearch = generateDates();
      
      console.log(`[BookingFlow] Auto-finding: Starting optimized search for ${selectedPreference} slots`);
      
      // Clear any previous state and show loading
      setAvailableSlots([]);
      setSelectedDate(null);
      setIsLoadingSlots(true);
      
      let foundResult = false;
      
      // Create promises for all dates but process them as they resolve
      const slotPromises = datesToSearch.map(async (date, index) => {
        try {
          const slots = await fetchGHLCalendarSlotsInternal(date);
          const preferredSlots = filterSlotsByPreference(slots, selectedPreference);
          return {
            date,
            index,
            allSlots: slots,
            preferredSlots,
            hasPreferredSlots: preferredSlots.length > 0
          };
        } catch (error) {
          console.error(`[BookingFlow] Error fetching slots for ${format(date, 'yyyy-MM-dd')}:`, error);
          return {
            date,
            index,
            allSlots: [],
            preferredSlots: [],
            hasPreferredSlots: false
          };
        }
      });

      // Process results as they come in, stop on first match
      try {
        for (const promise of slotPromises) {
          if (foundResult) break; // Exit early if we already found a result
          
          const result = await promise;
          
          if (!foundResult && result.hasPreferredSlots) {
            foundResult = true;
            
            console.log(`[BookingFlow] Auto-finding: Found ${result.preferredSlots.length} preferred slots on ${format(result.date, 'yyyy-MM-dd')} - stopping search immediately`);
            
            // Set the found date and slots immediately
            setSelectedDate(result.date);
            setAvailableSlots(result.allSlots);
             
            // Animate to the selected date
            setTimeout(() => {
              if (datesContainerRef.current) {
                const container = datesContainerRef.current;
                const dateCards = container.querySelectorAll('.date-card');
                const selectedIndex = result.index;
                
                if (dateCards[selectedIndex]) {
                  const selectedCard = dateCards[selectedIndex] as HTMLElement;
                  const containerWidth = container.clientWidth;
                  const cardWidth = selectedCard.offsetWidth;
                  const cardLeft = selectedCard.offsetLeft;
                  const centerPosition = cardLeft - (containerWidth / 2) + (cardWidth / 2);
                  
                  container.scrollTo({ left: centerPosition, behavior: 'smooth' });
                }
              }
            }, 100);

            // Stay on timeslots step
            setCurrentStep('timeslots');
            
            didAutoFindJustCompleteRef.current = true;
            
            // Clean up loading state immediately
            setIsAutoFindingDate(false);
            setIsLoadingSlots(false);
            
            return; // Exit the function immediately
          }
        }
        
        // Only reach here if no preferred slots were found in any date
        if (!foundResult) {
          console.log('[BookingFlow] Auto-finding: No preferred slots found in the next 14 days.');
          
          // Wait for first promise to get the first date's slots
          const firstResult = await slotPromises[0];
          setSelectedDate(firstResult.date);
          setAvailableSlots(firstResult.allSlots);
          setCurrentStep('timeslots');
        }
        
      } catch (error) {
        console.error('[BookingFlow] Error in optimized auto-finding:', error);
      }
      
      // Clean up loading state
      setIsAutoFindingDate(false);
      setIsLoadingSlots(false);
    };

    findAndSetParallel();
  }, [isAutoFindingDate, selectedPreference, autoFindDateAttempt]);

  // Handle preference selection
  const handlePreferenceSelect = (preference: string) => {
    setSelectedPreference(preference);
    setIsAutoFindingDate(true);
    setAutoFindDateAttempt(prev => prev + 1);
    setSelectedTime(null);
    setSelectedDate(null); // Clear selected date
    setAvailableSlots([]); // Clear previous slots immediately
    setCurrentStep('timeslots'); // Show timeslots step immediately for better UX
  };

  // Handle date selection with centering animation
  const handleDateSelect = (date: Date) => {
    setIsAutoFindingDate(false); // Stop auto-finding if user manually selects a date
    setSelectedDate(date); 
    setSelectedTime(null); // Clear time when new date is selected
    fetchAndSetSlotsForDate(date); // Manually fetch slots for this date
    setCurrentStep('timeslots'); // Ensure we are on the timeslots step
    
    if (datesContainerRef.current) {
      const container = datesContainerRef.current;
      const dateCards = container.querySelectorAll('.date-card');
      const dates = generateDates();
      const selectedIndex = dates.findIndex(d => isSameDay(d, date));
      
      if (selectedIndex !== -1 && dateCards[selectedIndex]) {
        const selectedCard = dateCards[selectedIndex] as HTMLElement;
        const containerWidth = container.clientWidth;
        const cardWidth = selectedCard.offsetWidth;
        const cardLeft = selectedCard.offsetLeft;
        
        const centerPosition = cardLeft - (containerWidth / 2) + (cardWidth / 2);
        
        container.scrollTo({
          left: centerPosition,
          behavior: 'smooth'
        });
        
        selectedCard.style.transform = 'translateY(-8px) scale(1.05)';
        selectedCard.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
        
        setTimeout(() => {
          selectedCard.style.transform = 'translateY(-4px)';
          selectedCard.style.transition = 'all 0.3s ease';
        }, 300);
      }
    }
  };

  // Handle time slot selection
  const handleTimeSelect = (slotStartTimeISO: string) => {
    setIsAutoFindingDate(false); // Stop auto-finding if user manually selects a time
    setSelectedTime(slotStartTimeISO);
    setCurrentStep('contact');
  };

  // Handle form submission with actual booking
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log('[BookingFlow handleSubmit] Form submitted. Current step:', currentStep, 'isBooking:', isBooking);
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const phone = formData.get('phone') as string;

    if (!selectedDate || !selectedTime) {
      console.warn('[BookingFlow handleSubmit] Validation failed: Date or time not selected.');
      setBookingError('Please select a date and time for your appointment.');
      return;
    }

    if (!email) {
      console.warn('[BookingFlow handleSubmit] Validation failed: Email not provided.');
      setBookingError('Please provide your email address.');
      return;
    }

    console.log('[BookingFlow handleSubmit] About to setBookingError(null) and setIsBooking(true).');
    setBookingError(null);
    setIsBooking(true);
    // Note: Logging isBooking here won't show true yet due to async nature of setState

    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const bookingData = {
        email: email.trim(),
        phone: phone?.trim() || undefined,
        selectedSlot: selectedTime,
        selectedTimezone: timezone
      };

      console.log('[BookingFlow handleSubmit] Submitting appointment booking to API:', bookingData);

      const response = await fetch('/api/book-appointment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingData),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('[BookingFlow handleSubmit] API response not OK:', result);
        throw new Error(result.error || 'Failed to book appointment');
      }

      console.log('[BookingFlow handleSubmit] API call successful. Result:', result);
      console.log('[BookingFlow handleSubmit] About to setIsBooking(false).');
      setIsBooking(false);

      setTimeout(() => {
        console.log('[BookingFlow handleSubmit setTimeout] Entered. Current step before updates:', currentStep, 'isBooking (expected false):', isBooking); 
        // isBooking might not be updated in this closure if accessed directly, rely on useEffect log for true state change timing
        console.log('[BookingFlow handleSubmit setTimeout] About to setAppointmentDetails.');
        setAppointmentDetails({
          date: formatDateForDisplay(selectedDate),
          time: format(parseISO(selectedTime), 'HH:mm', { locale: it }),
          email,
          phone: phone || '',
        });
        console.log('[BookingFlow handleSubmit setTimeout] Did setAppointmentDetails. About to setCurrentStep(\'confirmation\').');
        setCurrentStep('confirmation');
        // Note: Logging currentStep here won't show 'confirmation' yet
      }, 0);

    } catch (error) {
      console.error('[BookingFlow handleSubmit] Error during booking process:', error);
      setBookingError(error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.');
      console.log('[BookingFlow handleSubmit catch] About to setIsBooking(false) due to error.');
      setIsBooking(false);
    }
  };

  // Handle date navigation
  const handleDateNavigation = (direction: 'prev' | 'next') => {
    if (datesContainerRef.current) {
      const scrollAmount = 200;
      const currentScroll = datesContainerRef.current.scrollLeft;
      datesContainerRef.current.scrollTo({
        left: currentScroll + (direction === 'prev' ? -scrollAmount : scrollAmount),
        behavior: 'smooth'
      });
    }
  };

  // Center the selected date when the timeslots step becomes visible and on initial load
  useEffect(() => {
    if (currentStep === 'timeslots' && selectedDate && datesContainerRef.current) {
      setTimeout(() => {
        const container = datesContainerRef.current;
        if (!container) return;

        const dateCards = container.querySelectorAll('.date-card');
        const dates = generateDates();
        const selectedIndex = dates.findIndex(d => isSameDay(d, selectedDate));
        
        if (selectedIndex !== -1 && dateCards[selectedIndex]) {
          const selectedCard = dateCards[selectedIndex] as HTMLElement;
          const containerWidth = container.clientWidth;
          const cardWidth = selectedCard.offsetWidth;
          const cardLeft = selectedCard.offsetLeft;
          
          const centerPosition = cardLeft - (containerWidth / 2) + (cardWidth / 2);
          
          container.scrollTo({
            left: centerPosition,
            behavior: 'smooth'
          });
        }
      }, 100); // Small delay for DOM readiness
    }
  }, [currentStep, selectedDate]);

  const calculateDuration = (startTimeISO: string, endTimeISO: string): string => {
    if (!startTimeISO || !endTimeISO) return '';
    try {
      const start = parseISO(startTimeISO);
      const end = parseISO(endTimeISO);
      const diffMins = differenceInMinutes(end, start);
      if (isNaN(diffMins) || diffMins <= 0) return '';
      return `${diffMins} min`;
    } catch (error) {
      console.error("Error calculating duration:", error);
      return '';
    }
  };

  return (
    <div className="booking-flow">
      {/* Step 1: Preference */}
      <div className={`booking-step ${currentStep === 'preference' ? '' : 'hidden'}`}>
        <div className="step-header">
          <h2>Sei più libero le mattine o i pomeriggi?</h2>
        </div>
        <div className="preference-options">
          <div
            className={`preference-option ${selectedPreference === 'morning' ? 'selected' : ''}`}
            data-preference="morning"
            onClick={() => handlePreferenceSelect('morning')}
          >
            <i className="fas fa-coffee"></i>
            <span>Mattina</span>
          </div>
          <div
            className={`preference-option ${selectedPreference === 'afternoon' ? 'selected' : ''}`}
            data-preference="afternoon"
            onClick={() => handlePreferenceSelect('afternoon')}
          >
            <i className="fas fa-briefcase"></i>
            <span>Pomeriggio</span>
          </div>
        </div>
      </div>

      {/* Step 2: Available Slots */}
      <div className={`booking-step ${currentStep === 'timeslots' ? '' : 'hidden'}`} id="step-timeslots">
        <div className="step-header">
          <button
            className="back-icon"
            onClick={() => setCurrentStep('preference')}
            aria-label="Torna indietro"
          >
            <i className="fas fa-chevron-left"></i>
          </button>
          {/* Optional: Display selected date in header */}
          {selectedDate && <h2>{formatDateForDisplay(selectedDate)}</h2>}
        </div>
        <div className="date-selector">
          <button 
            className="date-nav" 
            onClick={() => handleDateNavigation('prev')}
            aria-label="Date precedenti"
          >
            <i className="fas fa-chevron-left"></i>
          </button>
          <div className="dates-container" ref={datesContainerRef}>
            {generateDates().map((date, index) => (
              <div
                key={date.toISOString()}
                className={`date-card ${selectedDate && isSameDay(date, selectedDate) ? 'selected' : ''}`}
                onClick={() => handleDateSelect(date)}
              >
                <div className="day-name">{format(date, 'EEE', { locale: it })}</div>
                <div className="day-number">{format(date, 'd')}</div>
                <div className="month">{format(date, 'MMM', { locale: it })}</div>
              </div>
            ))}
          </div>
          <button 
            className="date-nav" 
            onClick={() => handleDateNavigation('next')}
            aria-label="Date successive"
          >
            <i className="fas fa-chevron-right"></i>
          </button>
        </div>
        
        <div className={`timeslots-container ${
          (isAutoFindingDate || isLoadingSlots) ? 'loading-state' : 
          availableSlots.length > 0 ? 'has-slots' : 'empty-state'
        }`}>
          {isAutoFindingDate || isLoadingSlots ? (
            <div key="loading" className="loading-state-centered">
              <p className="loading-message">
                {isAutoFindingDate 
                  ? `Ricerca del primo ${selectedPreference === 'morning' ? 'appuntamento mattutino' : 'appuntamento pomeridiano'} disponibile...`
                  : 'Caricamento fasce orarie...'
                }
              </p>
            </div>
          ) : availableSlots.length > 0 ? (
            <React.Fragment key="slots">
              {availableSlots.map((slot) => (
                <div
                  key={slot.start}
                  className={`timeslot ${selectedTime === slot.start ? 'selected' : ''}`}
                  onClick={() => handleTimeSelect(slot.start)}
                >
                  <div className="time">{slot.displayTime}</div>
                  <div className="duration">{calculateDuration(slot.start, slot.end)}</div>
                </div>
              ))}
            </React.Fragment>
          ) : (
            <div key="empty" className="no-slots-message">
              <div className="empty-state-icon">
                <i className="fas fa-calendar-times"></i>
              </div>
              <p>Nessuna fascia oraria disponibile per questa data.</p>
            </div>
          )}
        </div>
      </div>

      {/* Step 3: Contact Information */}
      <div className={`booking-step ${currentStep === 'contact' ? '' : 'hidden'}`}>
        <div className="step-header">
          <button
            className="back-icon"
            onClick={() => {
                setCurrentStep('timeslots');
                setSelectedTime(null); // Clear selected time when going back
                setBookingError(null); // Clear any booking errors
                // Optionally: trigger auto-finding again if desired, or let user manually pick
                // setIsAutoFindingDate(true); 
                // setAutoFindDateAttempt(prev => prev + 1);
            }}
            aria-label="Torna indietro"
            disabled={isBooking}
          >
            <i className="fas fa-chevron-left"></i>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          {bookingError && (
            <div className="error-message" style={{ 
              color: 'var(--error-color)', 
              marginBottom: '1rem', 
              padding: '0.75rem', 
              backgroundColor: 'rgba(255, 86, 86, 0.1)', 
              border: '1px solid rgba(255, 86, 86, 0.3)', 
              borderRadius: 'var(--radius-sm)', 
              fontSize: '0.875rem' 
            }}>
              {bookingError}
            </div>
          )}
          <div className="form-group">
            <label htmlFor="email">Email*</label>
            <input 
              type="email" 
              id="email" 
              name="email" 
              required 
              placeholder="La tua email" 
              disabled={isBooking}
            />
          </div>
          <div className="form-group">
            <label htmlFor="phone">Telefono</label>
            <input 
              type="tel" 
              id="phone" 
              name="phone" 
              placeholder="Il tuo miglior numero" 
              disabled={isBooking}
            />
          </div>
          <button 
            type="submit" 
            className="submit-button"
            disabled={isBooking}
          >
            {isBooking ? (
              'Prenotazione in corso...' // Simplified: no icon, just text
            ) : (
              'Conferma Appuntamento'
            )}
          </button>
        </form>
      </div>

      {/* Step 4: Confirmation */}
      <div className={`booking-step ${currentStep === 'confirmation' ? '' : 'hidden'}`}>
        <div className="confirmation-content">
          <i className="fas fa-check-circle"></i>
          <h2>Appuntamento confermato con il tuo coach</h2>
          {appointmentDetails && (
            <div className="appointment-details">
              <div className="detail-item">
                <div className="label">Data</div>
                <div className="value">{appointmentDetails.date}</div>
              </div>
              <div className="detail-item">
                <div className="label">Orario</div>
                <div className="value">{appointmentDetails.time}</div>
              </div>
              <div className="detail-item">
                <div className="label">Email</div>
                <div className="value">{appointmentDetails.email}</div>
              </div>
              <div className="detail-item">
                <div className="label">Telefono</div>
                <div className="value">{appointmentDetails.phone}</div>
              </div>
            </div>
          )}
          <p>Riceverai un'email di conferma con tutti i dettagli.</p>
        </div>
      </div>
    </div>
  );
} 