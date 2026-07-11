/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RoomTier, Attraction, Activity, Testimonial } from "./types";

export const ROOMS: RoomTier[] = [
  {
    id: "comfort-cottage",
    name: "Comfort Cottage · Partial Sea View",
    description: "A queen bed beneath a vaulted timber ceiling, a private terrace opening to the garden, and the sound of the sea just beyond the palms. Rollaway available for a third guest.",
    pricePerNight: 280,
    size: "20–22 m²",
    capacity: "sleeps up to 3",
    amenities: [
      "Air conditioning",
      "Flat-screen TV",
      "Private bathroom",
      "Hot water",
      "Queen bed",
      "Vaulted timber ceiling",
      "Private terrace opening to garden",
      "Rollaway bed available"
    ],
    imageUrl: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80",
    images: [
      "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80"
    ],
    availabilityCount: 3
  },
  {
    id: "deluxe-beachfront-suite",
    name: "Deluxe Beachfront Suite",
    description: "The only front-row villa. A king bed and large sofa bed, a separate seating area, and a generous private entrance framing an uninterrupted view of the water from the moment you wake.",
    pricePerNight: 480,
    size: "45–50 m²",
    capacity: "sleeps up to 4",
    amenities: [
      "Air conditioning",
      "Flat-screen TV",
      "Private bathroom",
      "Hot water",
      "Uninterrupted sea view",
      "King bed & large sofa bed",
      "Separate seating area",
      "Generous private entrance"
    ],
    imageUrl: "/src/assets/images/baia_luxury_room_1783731990599.jpg",
    images: [
      "/src/assets/images/baia_luxury_room_1783731990599.jpg",
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80"
    ],
    availabilityCount: 1
  }
];

export const ATTRACTIONS: Attraction[] = [
  {
    id: "port-barton",
    name: "Port Barton Island-Hopping",
    category: "Island",
    description: "A laid-back coastal village and the jump-off for Palawan's gentler island-hopping — white-sand islets, coral gardens, and calm turquoise bays a short boat ride from BAIA.",
    hiddenGem: false,
    distanceFromResort: "30–40 mins by boat",
    coordinates: { x: 30, y: 40 },
    imageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
    tips: "Let our concierge arrange a private outrigger charter from the shoreline directly in front of BAIA."
  },
  {
    id: "turtle-bay",
    name: "Turtle Bay",
    category: "Nature",
    description: "A sheltered bay known for green sea turtle sightings and quiet snorkeling over shallow reefs — a peaceful half-day escape by boat from BAIA.",
    hiddenGem: false,
    distanceFromResort: "20 mins by boat",
    coordinates: { x: 52, y: 32 },
    imageUrl: "https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?auto=format&fit=crop&w=800&q=80",
    tips: "Best at high tide for clear water and calm entry. Bring reef-safe sunscreen."
  },
  {
    id: "german-island",
    name: "German Island",
    category: "Island",
    description: "A small, tranquil island with a sweeping sandbar and pale shallows — ideal for a private picnic, wading, and undisturbed swimming.",
    hiddenGem: true,
    distanceFromResort: "25 mins by boat",
    coordinates: { x: 44, y: 58 },
    imageUrl: "https://images.unsplash.com/photo-1559128010-7c1ad6e1b6a5?auto=format&fit=crop&w=800&q=80",
    tips: "Ask the boat captain about the low-tide sandbar that nearly connects to the neighboring islet."
  },
  {
    id: "long-beach",
    name: "San Vicente Long Beach",
    category: "Sights",
    description: "One of the longest continuous white-sand beaches in the Philippines — a vast, uncrowded shoreline perfect for long barefoot walks at sunrise.",
    hiddenGem: false,
    distanceFromResort: "10 mins drive",
    coordinates: { x: 60, y: 22 },
    imageUrl: "https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?auto=format&fit=crop&w=800&q=80",
    tips: "Go at first light for the emptiest, most photogenic stretch of sand."
  },
  {
    id: "pamuayan-falls",
    name: "Pamuayan Falls",
    category: "Nature",
    description: "A cool, multi-tiered inland waterfall set in lush forest just behind San Vicente — a refreshing trek away from the coast.",
    hiddenGem: true,
    distanceFromResort: "15 mins drive",
    coordinates: { x: 70, y: 50 },
    imageUrl: "https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=800&q=80",
    tips: "Wear reef shoes and go after rain for the fullest flow."
  },
  {
    id: "sugay-river",
    name: "Sugay River Mangroves",
    category: "Nature",
    description: "Winding mangrove channels where the river meets the sea — paddle or drift through a quiet nursery of birds, crabs, and rooted trees.",
    hiddenGem: true,
    distanceFromResort: "8 mins drive",
    coordinates: { x: 38, y: 66 },
    imageUrl: "https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&w=800&q=80",
    tips: "Calmest at early morning. Lovely for drone and bird photography."
  }
];

export const ACTIVITIES: Activity[] = [
  {
    id: "island-hopping",
    title: "Private Island-Hopping Charter",
    category: "Adventure",
    description: "Drift between Port Barton's calm islets, Turtle Bay's reefs, and the sandbar at German Island aboard an authorized local outrigger that picks you up right on BAIA's shoreline.",
    duration: "Half / Full Day",
    price: "Rates on request",
    difficulty: "Easy",
    imageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "coastal-ride",
    title: "Scooter & Bicycle Coastal Tour",
    category: "Nature",
    description: "Explore San Vicente at your own pace — cruise to Long Beach, the fishing village, and Pamuayan Falls on a scooter, moped, or bicycle rented at the front desk.",
    duration: "Self-guided",
    price: "Rates on request",
    difficulty: "Easy",
    imageUrl: "https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "island-wellness",
    title: "Sunrise Vinyasa & Sound Healing",
    category: "Wellness",
    description: "Start your morning in our open-air beachfront shala. Gentle yoga flow, breathing, and ambient sound baths to harmonize your body with the rhythm of the sea.",
    duration: "90 Mins",
    price: "Complimentary for guests",
    difficulty: "Easy",
    imageUrl: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=800&q=80"
  }
];

export const TESTIMONIALS: Testimonial[] = [
  {
    id: "t1",
    guestName: "Clarissa & Robert",
    location: "Stockholm, Sweden",
    text: "BAIA redefined our understanding of luxury. Feeling the sea breeze sweep through our villa while falling asleep to the ocean rhythm was unforgettable. The staff knew our names, our favorite coffees, and anticipated every desire.",
    rating: 5,
    stayDate: "March 2026"
  },
  {
    id: "t2",
    guestName: "Julian Vance",
    location: "California, USA",
    text: "A masterpiece of sustainable architecture and soul. The design is raw and grounded yet incredibly high-end. Mornings on the beach, a sound bath at sunrise, and a private dinner by the water—this place is paradise.",
    rating: 5,
    stayDate: "June 2026"
  },
  {
    id: "t3",
    guestName: "Yuki Tanaka",
    location: "Tokyo, Japan",
    text: "True silence, beautiful isolation, yet close to everything. The custom interactive map helped us find secluded hidden gems we never would have discovered. The attention to detail at BAIA is unmatched.",
    rating: 5,
    stayDate: "May 2026"
  }
];
