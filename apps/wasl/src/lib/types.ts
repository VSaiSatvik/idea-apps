export type Ack = { kind: "invoice" | "new_due_date"; at: string; byName: string; byPhone?: string; invoiceHash: string; dueOn: string };
export type Admission = { at: string; sender: string; text: string; pattern: string };
export type Invoice = {
  id: string; number: string; creditor: { name: string }; debtor: { name: string; phone?: string; email?: string };
  amountAED: number; description: string; issuedOn: string; dueOn: string; hasSignedContract: boolean;
  status: "sent" | "acknowledged" | "overdue" | "paid"; acknowledgments: Ack[]; admissions: Admission[];
  ackUrl: string; overdue: boolean;
  evidence: { strength: "strong" | "moderate" | "weak"; score: number; reasons: string[] };
  triage: { route: "law_firm_referral" | "self_serve_demand_and_small_claims" | "relationship_only"; why: string };
};
export type Step = { day: number; tone: "friendly" | "firm" | "options" | "final"; en: string; ar: string };
export const aed = (n: number) => `AED ${n.toLocaleString("en-US")}`;
export const routeLabel = { law_firm_referral: "Law firm referral", self_serve_demand_and_small_claims: "Demand + small claims", relationship_only: "Keep it friendly" } as const;
