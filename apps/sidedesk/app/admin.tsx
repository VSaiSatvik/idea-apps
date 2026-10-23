import { api } from "../src/lib/api";
import type { Student } from "../src/lib/types";
import { useLoad } from "../src/lib/useLoad";
import { confirm, notify } from "../src/ui/confirm";
import { Button, Card, ErrorText, H2, Loading, P, Pill, Row, Screen, Small } from "../src/ui/kit";

type Admin = { studentsNeeded: number; waitlist: Student[]; active: Student[]; queue: number; pnl: { revenueAED: number; wagesAED: number; permitsAED: number; paymentFeesAED: number; grossMarginAED: number } };

export default function AdminScreen() {
  const { data, error, loading, reload } = useLoad(() => api<Admin>("GET", "/sidedesk/admin"));
  const activate = async (s: Student) => {
    if (!(await confirm(`Activate ${s.name}?`, "Only after you've filed their part-time work permit with MOHRE (and have their sponsor's approval if needed).", "Permit filed — activate"))) return;
    try { await api("POST", `/sidedesk/admin/students/${s.id}/permit`); await reload(); } catch (e) { notify("Couldn't activate", (e as Error).message); }
  };
  if (!data) return <Screen>{error ? <ErrorText message={error} /> : <Loading />}</Screen>;
  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Card>
        <P>{data.queue} tasks queued · {data.studentsNeeded} more students needed</P>
        <Small>Revenue AED {data.pnl.revenueAED} · wages AED {data.pnl.wagesAED} · permits AED {data.pnl.permitsAED} · margin AED {data.pnl.grossMarginAED}</Small>
      </Card>
      <H2>Waitlist ({data.waitlist.length})</H2>
      {data.waitlist.map((s) => (
        <Card key={s.id}>
          <Row wrap><P>{s.name}</P>{s.sponsorApproval ? <Pill text="Sponsor OK" tone="good" /> : <Pill text="Needs sponsor letter" tone="warn" />}</Row>
          <Small>{s.university} · {s.universityEmail} · age {s.age} · {s.skills.join(", ")}</Small>
          <Button small title="Activate (permit filed)" onPress={() => { void activate(s); }} disabled={!s.sponsorApproval} />
        </Card>
      ))}
      <H2>Active ({data.active.length})</H2>
      {data.active.map((s) => <Card key={s.id}><P>{s.name}</P><Small>Permit until {s.permit?.expiresOn} · AED {Math.round(s.earnedAED)} earned</Small></Card>)}
    </Screen>
  );
}
