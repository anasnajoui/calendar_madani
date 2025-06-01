'use client';

import React from 'react';
import Script from 'next/script';
import BookingFlow from './components/BookingFlow';

export default function Home() {
  return (
    <main>
      <div className="page-container">
        <div className="logo-container">
          <img src="/madani.png" alt="Madani Logo" className="logo" />
        </div>
        <div className="container">
          <BookingFlow />
        </div>
      </div>

      {/* Load Font Awesome */}
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/js/all.min.js" />
    </main>
  );
} 