/** Fictional venues for demos and tests (names invented; coordinates near Al Quoz, JLT and Jumeirah). */
import type { Category, Venue } from "./core.js";

type V = Omit<Venue, "id">;
const v = (name: string, area: string, lat: number, lng: number, category: Category, opens = 8, closes = 22): V => ({ name, area, lat, lng, category, opens, closes });

export const SEED_VENUES: V[] = [
  // Al Quoz cluster
  v("Kiln Coffee", "Al Quoz", 25.1412, 55.2265, "coffee", 7, 19),
  v("Sourdough Lane", "Al Quoz", 25.1420, 55.2281, "bakery", 7, 17),
  v("Saffron Brunch Club", "Al Quoz", 25.1398, 55.2290, "brunch", 8, 16),
  v("Date & Pistachio", "Al Quoz", 25.1431, 55.2302, "dessert", 11, 23),
  v("Kiln Coffee Two", "Al Quoz", 25.1405, 55.2310, "coffee", 7, 19),
  // JLT cluster
  v("Cluster D Roasters", "JLT", 25.0730, 55.1440, "coffee", 7, 22),
  v("Green Press", "JLT", 25.0742, 55.1452, "juice", 8, 21),
  v("Seoul Bowl", "JLT", 25.0721, 55.1461, "asian", 12, 23),
  v("Kunafa Corner", "JLT", 25.0750, 55.1430, "dessert", 12, 24),
  v("Smash Lab", "JLT", 25.0715, 55.1425, "burger", 12, 24),
  // Jumeirah (too spread out for a walking crawl)
  v("Beach Road Bakes", "Jumeirah", 25.2210, 55.2560, "bakery", 7, 18),
  v("Wasl Pizza", "Jumeirah", 25.1990, 55.2370, "pizza", 12, 23),
];
