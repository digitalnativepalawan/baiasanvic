/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface RoomTier {
  id: string;
  name: string;
  description: string;
  pricePerNight: number;
  size: string; // e.g. "160 sqm"
  capacity: string; // e.g. "2 Adults"
  amenities: string[];
  imageUrl: string;
  images?: string[]; // Multiple images/videos
  availabilityCount: number;
}

export interface Attraction {
  id: string;
  name: string;
  category: "Surf" | "Nature" | "Island" | "Sights";
  description: string;
  hiddenGem: boolean;
  distanceFromResort: string; // e.g. "15 mins by boat" or "20 mins ride"
  coordinates: { x: number; y: number }; // percentage coords (0-100) for custom SVG map
  imageUrl: string;
  tips: string;
}

export interface Activity {
  id: string;
  title: string;
  category: string;
  description: string;
  duration: string;
  price: string;
  difficulty: "Easy" | "Medium" | "Challenging";
  imageUrl: string;
}

export interface Testimonial {
  id: string;
  guestName: string;
  location: string;
  text: string;
  rating: number;
  stayDate: string;
}

export interface Reservation {
  id: string;
  checkIn: string;
  checkOut: string;
  guestName: string;
  guestEmail: string;
  guestsCount: number;
  roomTierId: string;
  roomTierName: string;
  totalNights: number;
  totalPrice: number;
  status: "Confirmed" | "Pending";
  paymentCardLast4: string;
  createdAt: string;
}
