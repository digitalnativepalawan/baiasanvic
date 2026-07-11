/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { ChevronDown, Calendar, Users } from "lucide-react";

interface BookingBarProps {
  onCheckAvailability: (bookingData: {
    checkIn: string;
    checkOut: string;
    guests: number;
  }) => void;
}

export default function BookingBar({ onCheckAvailability }: BookingBarProps) {
  // Set default dates: tomorrow as check-in, 5 days later as check-out
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const fiveDaysLater = new Date(tomorrow);
  fiveDaysLater.setDate(tomorrow.getDate() + 5);

  const formatDateString = (d: Date) => {
    return d.toISOString().split("T")[0];
  };

  const [checkIn, setCheckIn] = useState(formatDateString(tomorrow));
  const [checkOut, setCheckOut] = useState(formatDateString(fiveDaysLater));
  const [guests, setGuests] = useState(2);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCheckAvailability({
      checkIn,
      checkOut,
      guests,
    });
  };

  // Convert "YYYY-MM-DD" to human readable "MMM DD, YYYY"
  const formatHumanDate = (dateStr: string) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div
      id="booking-bar-root"
      className="bg-white border border-luxury-800 p-8 lg:p-10 w-full max-w-7xl mx-auto shadow-md relative z-10"
    >
      <form
        id="booking-form"
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center"
      >
        {/* Title column */}
        <div id="booking-cta-text" className="md:col-span-3 text-left">
          <h3 className="text-xl lg:text-2xl uppercase tracking-[0.2em] font-serif text-luxury-100 font-medium">
            Begin Your<br />Journey
          </h3>
          <p className="text-xs text-luxury-400 font-sans tracking-wide mt-1.5 leading-relaxed">
            We can't wait to welcome you home.
          </p>
        </div>

        {/* Inputs section */}
        <div id="booking-inputs" className="md:col-span-9 grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
          {/* Check-In */}
          <div id="check-in-group" className="relative flex flex-col space-y-2 text-left">
            <label className="text-[10px] tracking-[0.25em] font-sans text-luxury-400 font-semibold uppercase">
              CHECK-IN
            </label>
            <div className="relative cursor-pointer group">
              <input
                id="check-in-date-input"
                type="date"
                min={formatDateString(today)}
                value={checkIn}
                onChange={(e) => {
                  setCheckIn(e.target.value);
                  // Auto adjust checkout if check-out is before check-in
                  if (new Date(e.target.value) >= new Date(checkOut)) {
                    const newCheckOut = new Date(e.target.value);
                    newCheckOut.setDate(newCheckOut.getDate() + 2);
                    setCheckOut(formatDateString(newCheckOut));
                  }
                }}
                className="absolute inset-0 opacity-0 z-20 cursor-pointer w-full"
              />
              <div className="flex items-center justify-between border-b border-luxury-700 py-2.5 text-sm text-luxury-100 group-hover:border-gold-300 transition-colors">
                <span className="font-sans font-medium tracking-wide">
                  {formatHumanDate(checkIn)}
                </span>
                <Calendar size={14} className="text-luxury-400 group-hover:text-gold-300 transition-colors" />
              </div>
            </div>
          </div>

          {/* Check-Out */}
          <div id="check-out-group" className="relative flex flex-col space-y-2 text-left">
            <label className="text-[10px] tracking-[0.25em] font-sans text-luxury-400 font-semibold uppercase">
              CHECK-OUT
            </label>
            <div className="relative cursor-pointer group">
              <input
                id="check-out-date-input"
                type="date"
                min={checkIn}
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className="absolute inset-0 opacity-0 z-20 cursor-pointer w-full"
              />
              <div className="flex items-center justify-between border-b border-luxury-700 py-2.5 text-sm text-luxury-100 group-hover:border-gold-300 transition-colors">
                <span className="font-sans font-medium tracking-wide">
                  {formatHumanDate(checkOut)}
                </span>
                <Calendar size={14} className="text-luxury-400 group-hover:text-gold-300 transition-colors" />
              </div>
            </div>
          </div>

          {/* Guests */}
          <div id="guests-group" className="relative flex flex-col space-y-2 text-left">
            <label className="text-[10px] tracking-[0.25em] font-sans text-luxury-400 font-semibold uppercase">
              GUESTS
            </label>
            <div className="relative group">
              <select
                id="guests-count-select"
                value={guests}
                onChange={(e) => setGuests(Number(e.target.value))}
                className="absolute inset-0 opacity-0 z-20 cursor-pointer w-full animate-none bg-white text-luxury-100"
              >
                <option value={1} className="bg-white text-luxury-100">1 Adult</option>
                <option value={2} className="bg-white text-luxury-100">2 Adults</option>
                <option value={3} className="bg-white text-luxury-100">3 Adults</option>
                <option value={4} className="bg-white text-luxury-100">4 Adults</option>
              </select>
              <div className="flex items-center justify-between border-b border-luxury-700 py-2.5 text-sm text-luxury-100 group-hover:border-gold-300 transition-colors">
                <span className="font-sans font-medium tracking-wide">
                  {guests} {guests === 1 ? "Adult" : "Adults"}
                </span>
                <Users size={14} className="text-luxury-400 group-hover:text-gold-300 transition-colors" />
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div id="booking-submit-btn-container" className="col-span-1 md:col-span-12 mt-4 lg:mt-6 flex justify-end">
          <button
            type="submit"
            className="w-full md:w-auto bg-gold-500 hover:bg-gold-600 active:bg-gold-700 text-white px-10 py-4 text-[11px] tracking-[0.25em] font-sans font-bold hover:shadow-xl transition-all duration-300 cursor-pointer uppercase"
          >
            Check Availability
          </button>
        </div>
      </form>
    </div>
  );
}
