export type Category = "coffee" | "brunch" | "bakery" | "dessert" | "juice" | "burger" | "asian" | "arabic" | "pizza";
export type Venue = { id: string; name: string; area: string; lat: number; lng: number; category: Category; opens: number; closes: number };
export type Stop = { id: string; name: string; category: Category; area: string; paid: boolean; mine: boolean; code?: string; verifiedVisits?: number };
export type Pricing = { venueSlotBaseAED: number; venuePerVisitAED: number; venueVisitCap: number; creatorBaseAED: number; creatorPerVisitAED: number };
export type CrawlView = {
  id: string; state: "booking" | "booked" | "live" | "settled" | "cancelled"; postUrl?: string; liveOn?: string; walkKm: number;
  creator: { handle: string; followers: number } | null; stops: Stop[]; pricing: Pricing;
};
export type CreatorView = { id: string; handle: string; followers: number; permitNumber?: string; permitCheckedOn?: string; permit: { ok: boolean; reason: string } };
export type Me = { admin: boolean; venues: Venue[]; creator: CreatorView | null; crawls: CrawlView[]; categories: Category[]; pricing: Pricing };
export const stateLabel = { booking: "Booking venues", booked: "Creator booked", live: "Live", settled: "Finished", cancelled: "Cancelled" } as const;
export const stateTone = { booking: "warn", booked: "accent", live: "good", settled: "neutral", cancelled: "bad" } as const;
