import { useLocalSearchParams } from "expo-router";
import { api } from "../../src/lib/api";
import { statusLabel, statusTone, type Me } from "../../src/lib/types";
import { useLoad } from "../../src/lib/useLoad";
import { confirm, notify } from "../../src/ui/confirm";
import { Button, Card, ErrorText, H2, Loading, P, Pill, Row, Screen, Small } from "../../src/ui/kit";

export default function Order() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, reload } = useLoad(() => api<Me>("GET", "/sidedesk/me"), [id]);
  const o = data?.orders.find((x) => x.id === id);

  const decide = async (approved: boolean) => {
    if (!approved && !(await confirm("Reject and get a refund?", "Tell us what was wrong via Contact support so we can improve.", "Reject", true))) return;
    try { await api("POST", `/sidedesk/tasks/${id}/approve`, { approved }); await reload(); }
    catch (e) { notify("Couldn't update", (e as Error).message); }
  };

  if (!data) return <Screen>{error ? <ErrorText message={error} /> : <Loading />}</Screen>;
  if (!o) return <Screen><P>Order not found.</P></Screen>;
  return (
    <Screen>
      <Row wrap><Pill text={statusLabel[o.status]} tone={statusTone(o.status)} /><Small>AED {o.priceAED} · ordered {o.createdOn}</Small></Row>
      <H2>{o.title}</H2>
      <Card><Small>Your brief</Small><P selectable>{o.brief}</P></Card>
      {o.deliverable ? <Card><Small>Delivered</Small><P selectable>{o.deliverable}</P></Card> : null}
      {o.status === "delivered" ? (
        <Row>
          <Button title="Approve" onPress={() => { void decide(true); }} />
          <Button kind="secondary" title="Reject" onPress={() => { void decide(false); }} />
        </Row>
      ) : null}
      {o.status === "queued" || o.status === "claimed" || o.status === "qa" ? <Small>We'll notify you here when it's ready. Some tasks get a second student's quality check before delivery.</Small> : null}
    </Screen>
  );
}
