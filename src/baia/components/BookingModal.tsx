/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { X, Lock, CheckCircle, ArrowLeft, ArrowRight, Star, CreditCard, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useSite } from "../context/SiteContext";
import { RoomTier, Reservation } from "../types";
import { supabase } from "@/integrations/supabase/client";

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDates?: {
    checkIn: string;
    checkOut: string;
    guests: number;
  };
  onSubmitted?: (r: Reservation) => void;
}

export default function BookingModal({ isOpen, onClose, initialDates, onSubmitted }: BookingModalProps) {
  const { rooms } = useSite();
  // Booking progress steps: 1 = select-room, 2 = guest-details, 3 = confirmation
  const [step, setStep] = useState(1);

  // Search parameters state
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guestsCount, setGuestsCount] = useState(2);

  // Selected room state
  const [selectedRoom, setSelectedRoom] = useState<RoomTier | null>(null);

  // Guest details form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");

  // Payment form state
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Final reservation state
  const [confirmedReservation, setConfirmedReservation] = useState<Reservation | null>(null);

  // Set initial parameters when modal opens
  useEffect(() => {
    if (isOpen) {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const fiveDaysLater = new Date(tomorrow);
      fiveDaysLater.setDate(tomorrow.getDate() + 5);

      const defaultCheckIn = initialDates?.checkIn || tomorrow.toISOString().split("T")[0];
      const defaultCheckOut = initialDates?.checkOut || fiveDaysLater.toISOString().split("T")[0];
      const defaultGuests = initialDates?.guests || 2;

      setCheckIn(defaultCheckIn);
      setCheckOut(defaultCheckOut);
      setGuestsCount(defaultGuests);
      setSelectedRoom(rooms[0] || null); // default select the beachfront villa
      setStep(1);
      setIsProcessing(false);
      setErrors({});
      // Clear payment inputs for security
      setCardName("");
      setCardNumber("");
      setExpiry("");
      setCvv("");
    }
  }, [isOpen, initialDates]);

  if (!isOpen) return null;

  // Calculate reservation totals
  const totalNights = (() => {
    if (!checkIn || !checkOut) return 0;
    const diffTime = Math.abs(new Date(checkOut).getTime() - new Date(checkIn).getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
  })();

  const totalPrice = selectedRoom ? selectedRoom.pricePerNight * totalNights : 0;

  // Format YYYY-MM-DD to beautiful display
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

  // Input helper for credit card separation (1234 5678 ...)
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "");
    const formatted = value.replace(/(\d{4})(?=\d)/g, "$1 ").substring(0, 19);
    setCardNumber(formatted);
    if (errors.cardNumber) {
      setErrors((prev) => ({ ...prev, cardNumber: "" }));
    }
  };

  // Expiry date formatter (MM/YY)
  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "");
    let formatted = value;
    if (value.length > 2) {
      formatted = `${value.substring(0, 2)}/${value.substring(2, 4)}`;
    }
    setExpiry(formatted.substring(0, 5));
    if (errors.expiry) {
      setErrors((prev) => ({ ...prev, expiry: "" }));
    }
  };

  // CVV formatter (3-4 digits)
  const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").substring(0, 4);
    setCvv(value);
    if (errors.cvv) {
      setErrors((prev) => ({ ...prev, cvv: "" }));
    }
  };

  const handleNextToPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const tempErrors: Record<string, string> = {};
    if (!fullName.trim()) tempErrors.fullName = "Please enter your full name";
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) tempErrors.email = "Please enter a valid email address";
    if (!selectedRoom) tempErrors.fullName = "Please select a sanctuary first";

    if (Object.keys(tempErrors).length > 0) {
      setErrors(tempErrors);
      return;
    }
    setErrors({});
    setIsProcessing(true);

    // Submit inquiry to Supabase (status = pending). No payment is taken here —
    // BAIA responds by email to confirm rates and availability.
    const { data: inserted, error } = await supabase
      .from("booking_inquiries")
      .insert({
        check_in: checkIn,
        check_out: checkOut,
        guest_name: fullName,
        guest_email: email,
        guests_count: guestsCount,
        room_tier_id: selectedRoom!.id,
        room_tier_name: selectedRoom!.name,
        total_nights: totalNights,
        total_price: totalPrice,
        special_requests: specialRequests || null,
        status: "pending",
      })
      .select("id, reference, created_at")
      .single();

    setIsProcessing(false);

    if (error) {
      setErrors({ fullName: "We couldn't submit your inquiry just now. Please try again in a moment." });
      return;
    }

    const reservation: Reservation = {
      id: inserted?.reference ?? "BAIA-PENDING",
      checkIn,
      checkOut,
      guestName: fullName,
      guestEmail: email,
      guestsCount,
      roomTierId: selectedRoom!.id,
      roomTierName: selectedRoom!.name,
      totalNights,
      totalPrice,
      status: "Pending",
      paymentCardLast4: "",
      createdAt: inserted?.created_at ?? new Date().toISOString(),
    };

    onSubmitted?.(reservation);
    setConfirmedReservation(reservation);
    setStep(4);
  };

  // Fake payment step removed — kept as no-op for older references.
  const handlePaymentSubmit = handleNextToPayment;


  return (
    <div id="booking-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto bg-luxury-950/85 backdrop-blur-md">
      {/* Modal Container */}
      <motion.div
        id="booking-modal-content"
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: "spring", damping: 25, stiffness: 180 }}
        className="relative bg-luxury-900 border border-luxury-800 w-full max-w-4xl shadow-2xl flex flex-col my-8 overflow-hidden rounded-sm"
      >
        {/* Close Button */}
        <button
          id="booking-modal-close"
          onClick={onClose}
          disabled={isProcessing}
          className="absolute top-6 right-6 text-luxury-400 hover:text-gold-500 transition-colors cursor-pointer z-20 p-1 bg-luxury-800/20 rounded-full hover:bg-luxury-800/50"
          aria-label="Close booking modal"
        >
          <X size={20} />
        </button>

        {/* Modal Header Progress Indicator */}
        <div id="booking-progress-header" className="border-b border-luxury-800/60 p-6 md:p-8 bg-luxury-950/20">
          <div className="flex items-center space-x-3 text-gold-300 font-serif mb-1">
            <span className="text-xs uppercase tracking-[0.25em] font-sans font-semibold">RESERVATIONS PORTAL</span>
          </div>
          <h2 className="text-xl md:text-2xl uppercase tracking-wider text-luxury-100 font-medium">
            {step === 1 && "Choose Your Villa sanctuary"}
            {step === 2 && "Personal Details"}
            {step === 4 && "Inquiry Received"}
          </h2>

          {/* Progress Steps Visualizer */}
          <div id="progress-steps-visual" className="flex items-center space-x-4 mt-4">
            {[
              { num: 1, label: "Select Room" },
              { num: 2, label: "Details" },
              { num: 4, label: "Confirmation" },
            ].map((s) => (
              <div key={s.num} className="flex items-center space-x-2">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-sans font-bold transition-all duration-300 ${
                    step >= s.num
                      ? "bg-gold-500 text-white"
                      : "border border-luxury-700 text-luxury-400"
                  }`}
                >
                  {step > s.num ? "✓" : s.num}
                </div>
                <span
                  className={`text-[10px] tracking-widest uppercase font-medium hidden sm:inline ${
                    step === s.num ? "text-luxury-100 font-bold" : "text-luxury-400"
                  }`}
                >
                  {s.label}
                </span>
                {s.num < 4 && <div className={`w-6 h-[1px] ${step > s.num ? "bg-gold-500" : "bg-luxury-800"}`} />}
              </div>
            ))}
          </div>
        </div>

        {/* Modal Main Content Box */}
        <div id="booking-modal-body" className="flex-1 overflow-y-auto max-h-[60vh] p-6 md:p-8">
          <AnimatePresence mode="wait">
            {/* STEP 1: SELECT ROOM */}
            {step === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-6"
              >
                {/* Stay Date Configuration Bar */}
                <div id="booking-dates-summary" className="bg-luxury-950 p-4 border border-luxury-800 flex flex-wrap gap-4 justify-between items-center text-left rounded-sm">
                  <div className="flex gap-6">
                    <div>
                      <p className="text-[9px] tracking-widest text-luxury-400 font-sans uppercase">CHECK-IN</p>
                      <p className="text-xs text-luxury-100 font-semibold font-sans mt-0.5">{formatHumanDate(checkIn)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] tracking-widest text-luxury-400 font-sans uppercase">CHECK-OUT</p>
                      <p className="text-xs text-luxury-100 font-semibold font-sans mt-0.5">{formatHumanDate(checkOut)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] tracking-widest text-luxury-400 font-sans uppercase">GUESTS</p>
                      <p className="text-xs text-luxury-100 font-semibold font-sans mt-0.5">{guestsCount} Adults</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] tracking-wider text-gold-300 font-sans bg-gold-500/10 px-3 py-1 uppercase rounded-full font-semibold">
                      {totalNights} NIGHTS STAY
                    </span>
                  </div>
                </div>

                {/* Rooms List */}
                <div id="rooms-selection-list" className="space-y-6">
                  {rooms.map((room) => (
                    <div
                      key={room.id}
                      onClick={() => setSelectedRoom(room)}
                      className={`group border cursor-pointer p-4 md:p-5 flex flex-col md:flex-row gap-6 transition-all duration-300 ${
                        selectedRoom?.id === room.id
                          ? "border-gold-500 bg-gold-500/5 shadow-xl"
                          : "border-luxury-800 hover:border-luxury-600 hover:bg-luxury-950/20"
                      }`}
                    >
                      {/* Room Photo */}
                      <div className="w-full md:w-1/3 aspect-[4/3] overflow-hidden bg-luxury-950 rounded-sm relative">
                        <img
                          src={room.imageUrl}
                          alt={room.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute top-3 left-3 bg-luxury-950/80 backdrop-blur-sm px-2.5 py-1 text-[10px] tracking-widest text-white uppercase rounded-sm">
                          {room.size}
                        </div>
                      </div>

                      {/* Room Info */}
                      <div className="flex-1 flex flex-col justify-between text-left">
                        <div>
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg md:text-xl text-luxury-100 font-medium group-hover:text-gold-300 transition-colors">
                              {room.name}
                            </h3>
                            <div className="text-right">
                              <span className="text-xs text-luxury-400 font-sans tracking-wide">Rates </span>
                              <span className="text-base font-serif font-semibold text-gold-300">On request</span>
                            </div>
                          </div>

                          <p className="text-xs text-luxury-300 mt-2 leading-relaxed">
                            {room.description}
                          </p>

                          {/* Quick features Grid */}
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-4">
                            {room.amenities.slice(0, 4).map((amenity, i) => (
                              <div key={i} className="flex items-center space-x-2 text-[11px] text-luxury-400 font-sans">
                                <span className="w-1.5 h-1.5 bg-gold-400 rounded-full" />
                                <span>{amenity}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Card Footer action info */}
                        <div className="flex items-center justify-between mt-6 pt-4 border-t border-luxury-800/40">
                          <span className="text-[10px] tracking-wider text-luxury-400 font-sans uppercase">
                            Capacity: {room.capacity}
                          </span>
                          <span
                            className={`text-[10px] tracking-wider uppercase font-semibold font-sans px-2.5 py-0.5 rounded-sm ${
                              selectedRoom?.id === room.id
                                ? "bg-gold-500 text-white"
                                : "text-gold-300 border border-gold-500/30 bg-gold-500/5"
                            }`}
                          >
                            {selectedRoom?.id === room.id ? "SELECTED" : "SELECT SANCTUARY"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Continue button */}
                <div id="step-1-footer" className="pt-6 border-t border-luxury-800/40 flex justify-end">
                  <button
                    onClick={() => setStep(2)}
                    disabled={!selectedRoom}
                    className="w-full sm:w-auto bg-gold-500 hover:bg-gold-600 active:bg-gold-700 disabled:opacity-50 text-white px-8 py-3.5 text-[11px] tracking-widest font-sans font-bold hover:shadow-lg transition-all uppercase flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <span>Proceed to details</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 2: DETAILS */}
            {step === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="grid grid-cols-1 md:grid-cols-12 gap-8 text-left"
              >
                {/* Guest Form Column */}
                <form id="guest-details-form" onSubmit={handleNextToPayment} className="md:col-span-7 space-y-5">
                  <h3 className="text-sm font-semibold tracking-wider text-gold-300 font-sans uppercase">
                    GUEST REGISTRATION
                  </h3>

                  {/* Full name */}
                  <div className="flex flex-col space-y-2">
                    <label className="text-[10px] tracking-widest text-luxury-400 font-sans uppercase font-semibold">
                      Full Name *
                    </label>
                    <input
                      id="guest-fullname-input"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: "" }));
                      }}
                      placeholder="e.g. John Doe"
                      className="bg-luxury-950 border border-luxury-800 rounded-sm px-4 py-3 text-sm text-luxury-100 placeholder-luxury-600 focus:outline-none focus:border-gold-300 transition-colors font-sans"
                    />
                    {errors.fullName && <p className="text-[10px] text-red-400 font-sans">{errors.fullName}</p>}
                  </div>

                  {/* Email address */}
                  <div className="flex flex-col space-y-2">
                    <label className="text-[10px] tracking-widest text-luxury-400 font-sans uppercase font-semibold">
                      Email Address *
                    </label>
                    <input
                      id="guest-email-input"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errors.email) setErrors((prev) => ({ ...prev, email: "" }));
                      }}
                      placeholder="e.g. johndoe@example.com"
                      className="bg-luxury-950 border border-luxury-800 rounded-sm px-4 py-3 text-sm text-luxury-100 placeholder-luxury-600 focus:outline-none focus:border-gold-300 transition-colors font-sans"
                    />
                    {errors.email && <p className="text-[10px] text-red-400 font-sans">{errors.email}</p>}
                  </div>

                  {/* Special requests */}
                  <div className="flex flex-col space-y-2">
                    <label className="text-[10px] tracking-widest text-luxury-400 font-sans uppercase font-semibold">
                      Special Requests & Flight Details
                    </label>
                    <textarea
                      id="guest-requests-textarea"
                      rows={4}
                      value={specialRequests}
                      onChange={(e) => setSpecialRequests(e.target.value)}
                      placeholder="e.g. Early check-in requests, dietary preferences, airport pickup details..."
                      className="bg-luxury-950 border border-luxury-800 rounded-sm px-4 py-3 text-sm text-luxury-100 placeholder-luxury-600 focus:outline-none focus:border-gold-300 transition-colors font-sans resize-none"
                    />
                  </div>

                  {/* Buttons */}
                  <div className="pt-4 flex items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="flex items-center space-x-2 text-[10px] tracking-wider text-luxury-400 hover:text-gold-500 font-sans uppercase cursor-pointer"
                    >
                      <ArrowLeft size={14} />
                      <span>Back to rooms</span>
                    </button>

                    <button
                      type="submit"
                      disabled={isProcessing}
                      className="bg-gold-500 hover:bg-gold-600 active:bg-gold-700 disabled:opacity-60 text-white px-8 py-3.5 text-[11px] tracking-widest font-sans font-bold hover:shadow-lg transition-all uppercase flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <span>{isProcessing ? "Submitting…" : "Submit Inquiry"}</span>
                      <ArrowRight size={14} />
                    </button>

                  </div>
                </form>

                {/* Booking Summary Sidebar */}
                <div id="booking-sidebar-summary" className="md:col-span-5 bg-luxury-950/80 p-6 border border-luxury-800 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-semibold tracking-wider text-gold-300 font-sans uppercase mb-4 pb-2 border-b border-luxury-800">
                      STAY SUMMARY
                    </h3>

                    {/* Room mini card */}
                    <div className="flex items-center space-x-4 mb-6">
                      <div className="w-16 h-12 rounded-sm overflow-hidden bg-luxury-900 flex-shrink-0">
                        <img
                          src={selectedRoom?.imageUrl}
                          alt={selectedRoom?.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="text-left">
                        <p className="text-xs text-luxury-100 font-semibold">{selectedRoom?.name}</p>
                        <p className="text-[10px] text-luxury-400 font-sans">{selectedRoom?.size} / {selectedRoom?.capacity}</p>
                      </div>
                    </div>

                    {/* Breakdown details */}
                    <div className="space-y-3.5 text-xs text-luxury-300">
                      <div className="flex justify-between">
                        <span>Check-In:</span>
                        <span className="text-luxury-100 font-semibold font-sans">{formatHumanDate(checkIn)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Check-Out:</span>
                        <span className="text-luxury-100 font-semibold font-sans">{formatHumanDate(checkOut)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Nights:</span>
                        <span className="text-luxury-100 font-semibold font-sans">{totalNights} Nights</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Guests:</span>
                        <span className="text-luxury-100 font-semibold font-sans">{guestsCount} Adults</span>
                      </div>

                      <div className="pt-4 border-t border-luxury-800 space-y-3">
                        <div className="flex justify-between text-xs">
                          <span>Room rate:</span>
                          <span>On request</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span>Service Charge & Tax (12%):</span>
                          <span className="text-luxury-400">Included</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Booking Total cost */}
                  <div className="pt-6 mt-6 border-t border-luxury-800 flex items-center justify-between">
                    <span className="text-sm tracking-widest text-luxury-400 uppercase font-sans">TOTAL:</span>
                    <span className="text-2xl font-serif font-bold text-gold-300">On request</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 3: PAYMENT */}
            {step === 3 && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="grid grid-cols-1 md:grid-cols-12 gap-8 text-left"
              >
                {/* Secure checkout form */}
                <form id="payment-gateways-form" onSubmit={handlePaymentSubmit} className="md:col-span-7 space-y-5">
                  <div className="flex items-center space-x-2 text-gold-300 font-sans mb-1">
                    <ShieldCheck size={18} />
                    <span className="text-xs font-semibold tracking-wider uppercase">
                      SECURE CHECKOUT - 256-bit SSL encryption
                    </span>
                  </div>

                  {/* Card Name */}
                  <div className="flex flex-col space-y-1.5">
                    <label className="text-[10px] tracking-widest text-luxury-400 font-sans uppercase font-semibold">
                      Name on Card
                    </label>
                    <input
                      id="card-name-input"
                      type="text"
                      required
                      value={cardName}
                      onChange={(e) => {
                        setCardName(e.target.value);
                        if (errors.cardName) setErrors((prev) => ({ ...prev, cardName: "" }));
                      }}
                      placeholder="e.g. JOHN DOE"
                      className="bg-luxury-950 border border-luxury-800 rounded-sm px-4 py-3 text-sm text-luxury-100 placeholder-luxury-700 uppercase focus:outline-none focus:border-gold-300 transition-colors font-sans"
                    />
                    {errors.cardName && <p className="text-[10px] text-red-400 font-sans">{errors.cardName}</p>}
                  </div>

                  {/* Card Number */}
                  <div className="flex flex-col space-y-1.5">
                    <label className="text-[10px] tracking-widest text-luxury-400 font-sans uppercase font-semibold">
                      Card Number
                    </label>
                    <div className="relative">
                      <input
                        id="card-number-input"
                        type="text"
                        required
                        value={cardNumber}
                        onChange={handleCardNumberChange}
                        placeholder="•••• •••• •••• ••••"
                        className="bg-luxury-950 border border-luxury-800 rounded-sm pl-12 pr-4 py-3 text-sm text-luxury-100 placeholder-luxury-700 focus:outline-none focus:border-gold-300 transition-colors font-mono w-full"
                      />
                      <CreditCard size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-luxury-500" />
                    </div>
                    {errors.cardNumber && <p className="text-[10px] text-red-400 font-sans">{errors.cardNumber}</p>}
                  </div>

                  {/* Expiry & CVV */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col space-y-1.5">
                      <label className="text-[10px] tracking-widest text-luxury-400 font-sans uppercase font-semibold">
                        Expiry Date
                      </label>
                      <input
                        id="card-expiry-input"
                        type="text"
                        required
                        value={expiry}
                        onChange={handleExpiryChange}
                        placeholder="MM/YY"
                        className="bg-luxury-950 border border-luxury-800 rounded-sm px-4 py-3 text-sm text-luxury-100 placeholder-luxury-700 focus:outline-none focus:border-gold-300 transition-colors font-mono"
                      />
                      {errors.expiry && <p className="text-[10px] text-red-400 font-sans">{errors.expiry}</p>}
                    </div>

                    <div className="flex flex-col space-y-1.5">
                      <label className="text-[10px] tracking-widest text-luxury-400 font-sans uppercase font-semibold">
                        CVV Code
                      </label>
                      <input
                        id="card-cvv-input"
                        type="password"
                        required
                        value={cvv}
                        onChange={handleCvvChange}
                        placeholder="•••"
                        className="bg-luxury-950 border border-luxury-800 rounded-sm px-4 py-3 text-sm text-luxury-100 placeholder-luxury-700 focus:outline-none focus:border-gold-300 transition-colors font-mono"
                      />
                      {errors.cvv && <p className="text-[10px] text-red-400 font-sans">{errors.cvv}</p>}
                    </div>
                  </div>

                  {/* Security Badge Warning */}
                  <div id="payment-warning-card" className="bg-luxury-950/60 p-4 border border-luxury-800/80 rounded-sm flex items-start space-x-3 text-xs text-luxury-400">
                    <Lock size={14} className="mt-0.5 text-gold-400 flex-shrink-0" />
                    <p className="leading-relaxed">
                      Your payment details are protected by standard TLS encryption. We adhere to PCI-DSS Level 1 compliance standards. BAIA does not store raw CVV codes.
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-4 flex items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      disabled={isProcessing}
                      className="flex items-center space-x-2 text-[10px] tracking-wider text-luxury-400 hover:text-gold-500 font-sans uppercase cursor-pointer disabled:opacity-50"
                    >
                      <ArrowLeft size={14} />
                      <span>Back to details</span>
                    </button>

                    <button
                      type="submit"
                      disabled={isProcessing}
                      className="bg-gold-500 hover:bg-gold-600 active:bg-gold-700 disabled:bg-gold-500/50 text-white px-10 py-4 text-[11px] tracking-widest font-sans font-bold hover:shadow-lg transition-all uppercase flex items-center justify-center space-x-2 cursor-pointer relative"
                    >
                      {isProcessing ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                          <span>Authorizing Transaction...</span>
                        </>
                      ) : (
                        <>
                          <Lock size={12} className="mr-1.5" />
                          <span>Pay & Secure Reservation</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* Checkout Summary Sidebar */}
                <div id="checkout-sidebar-summary" className="md:col-span-5 bg-luxury-950/80 p-6 border border-luxury-800 flex flex-col justify-between">
                  <div className="space-y-6">
                    <h3 className="text-sm font-semibold tracking-wider text-gold-300 font-sans uppercase pb-2 border-b border-luxury-800">
                      BILLING SUMMARY
                    </h3>

                    {/* Booking metadata */}
                    <div className="space-y-3.5 text-xs text-luxury-300">
                      <div className="flex justify-between">
                        <span>Selected Suite:</span>
                        <span className="text-luxury-100 font-semibold font-sans">{selectedRoom?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Dates:</span>
                        <span className="text-luxury-100 font-semibold font-sans">
                          {formatHumanDate(checkIn)} - {formatHumanDate(checkOut)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Nights / Guests:</span>
                        <span className="text-luxury-100 font-semibold font-sans">{totalNights} Nights / {guestsCount} Adults</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Lead Guest:</span>
                        <span className="text-luxury-100 font-semibold font-sans truncate max-w-[150px]">{fullName || email}</span>
                      </div>
                    </div>

                    {/* Safe Secure Transaction Badge */}
                    <div id="checkout-guarantee-badge" className="p-3 border border-dashed border-luxury-700 bg-luxury-900 rounded-sm flex items-center space-x-2.5">
                      <Star size={16} className="text-gold-300" />
                      <span className="text-[10px] tracking-wider uppercase font-semibold font-sans text-gold-300">
                        BAIA Direct Booking Guarantee
                      </span>
                    </div>
                  </div>

                  {/* Payment Cost Total */}
                  <div className="pt-6 mt-6 border-t border-luxury-800 flex items-center justify-between">
                    <span className="text-sm tracking-widest text-luxury-400 uppercase font-sans">TOTAL TO CHARGE:</span>
                    <span className="text-2xl font-serif font-bold text-gold-300">${totalPrice}</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 4: SUCCESS RECEIPT */}
            {step === 4 && confirmedReservation && (
              <motion.div
                key="step-4"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-xl mx-auto text-center space-y-6 py-6"
              >
                {/* Success Circle animation */}
                <div id="booking-success-animation-container" className="flex justify-center">
                  <div className="p-3 bg-gold-500/10 rounded-full border border-gold-500/20">
                    <CheckCircle className="text-gold-300 animate-pulse" size={54} />
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-serif text-luxury-100 uppercase tracking-wider">
                    We can't wait to welcome you home
                  </h3>
                  <p className="text-xs text-luxury-300 leading-relaxed max-w-md mx-auto">
                    Your luxury villa at BAIA has been reserved. A confirmation summary and pre-arrival concierge survey have been sent to <strong className="text-gold-300">{confirmedReservation.guestEmail}</strong>.
                  </p>
                </div>

                {/* Elegant Receipt Ticket */}
                <div id="booking-receipt-ticket" className="bg-luxury-950 border border-luxury-800 p-6 text-left rounded-sm space-y-4 font-sans text-xs">
                  <div className="flex justify-between items-center pb-3.5 border-b border-luxury-800/60">
                    <div>
                      <p className="text-[9px] tracking-widest text-luxury-400 uppercase font-semibold">RESERVATION CODE</p>
                      <p className="text-sm font-semibold text-gold-300 font-mono mt-0.5">{confirmedReservation.id}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] tracking-widest text-luxury-400 uppercase font-semibold">STATUS</p>
                      <span className="inline-block bg-green-500/10 text-green-400 text-[10px] px-2.5 py-0.5 uppercase tracking-wider font-semibold rounded-full mt-0.5">
                        {confirmedReservation.status}
                      </span>
                    </div>
                  </div>

                  {/* Summary grid */}
                  <div className="grid grid-cols-2 gap-y-3.5 text-luxury-300">
                    <div>
                      <p className="text-[9px] tracking-widest text-luxury-400 uppercase">SANCTUARY</p>
                      <p className="text-luxury-100 font-medium mt-0.5">{confirmedReservation.roomTierName}</p>
                    </div>
                    <div>
                      <p className="text-[9px] tracking-widest text-luxury-400 uppercase">GUEST</p>
                      <p className="text-luxury-100 font-medium mt-0.5 truncate">{confirmedReservation.guestName}</p>
                    </div>
                    <div>
                      <p className="text-[9px] tracking-widest text-luxury-400 uppercase">STAY DATES</p>
                      <p className="text-luxury-100 font-medium mt-0.5">
                        {formatHumanDate(confirmedReservation.checkIn)} - {formatHumanDate(confirmedReservation.checkOut)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] tracking-widest text-luxury-400 uppercase">DURATION & DETAILS</p>
                      <p className="text-luxury-100 font-medium mt-0.5">
                        {confirmedReservation.totalNights} Nights / {confirmedReservation.guestsCount} Guests
                      </p>
                    </div>
                  </div>

                  {/* Payment summary */}
                  <div className="pt-4 mt-2 border-t border-luxury-800/60 flex justify-between items-center">
                    <div>
                      <p className="text-[9px] tracking-widest text-luxury-400 uppercase">METHOD CHARGED</p>
                      <p className="text-luxury-100 font-mono mt-0.5">Visa Ending in {confirmedReservation.paymentCardLast4}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] tracking-widest text-luxury-400 uppercase">TOTAL CHARGED</p>
                      <p className="text-lg font-serif font-bold text-gold-300">${confirmedReservation.totalPrice}</p>
                    </div>
                  </div>
                </div>

                {/* Return button */}
                <div id="success-footer-actions">
                  <button
                    onClick={onClose}
                    className="w-full bg-gold-500 hover:bg-gold-600 text-white py-3 text-[11px] tracking-widest font-sans font-bold hover:shadow-md transition-all uppercase cursor-pointer"
                  >
                    Return to landing page
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
