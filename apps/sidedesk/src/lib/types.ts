export type MenuItem = { title: string; priceAED: number; minutes: number; aiDraft: boolean; skill: string; studentMinutes: number };
export type Menu = { menu: Record<string, MenuItem>; wageAEDPerHour: number; limits: { maxHoursPerDay: number; maxConsecutiveHours: number; minRestMinutes: number }; skills: string[] };
export type Task = {
  id: string; business: string; type: string; brief: string; title: string; priceAED: number;
  status: "queued" | "claimed" | "submitted" | "qa" | "delivered" | "approved" | "rejected";
  workMinutes: number; createdOn: string; deliverable?: string; earnAED?: number; studentId?: string;
};
export type Student = { id: string; name: string; university: string; skills: string[]; sponsorApproval: boolean; age: number; permit?: { filedOn: string; expiresOn: string }; earnedAED: number; active: boolean; universityEmail?: string };
export type Me = { admin: boolean; student: Student | null; orders: Task[] };
export const statusLabel: Record<Task["status"], string> = { queued: "Waiting for a student", claimed: "In progress", submitted: "Submitted", qa: "Quality check", delivered: "Ready for you", approved: "Approved", rejected: "Rejected · refunded" };
export const statusTone = (s: Task["status"]) => (s === "delivered" ? "accent" : s === "approved" ? "good" : s === "rejected" ? "bad" : "warn") as "accent" | "good" | "bad" | "warn";
export const minToTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
