import { router, useLocalSearchParams } from "expo-router";
import { api } from "../../../src/lib/api";
import { type CircleDetail } from "../../../src/lib/types";
import { useLoad } from "../../../src/lib/useLoad";
import { confirm, notify } from "../../../src/ui/confirm";
import { Button, Card, ErrorText, H2, Loading, P, Pill, Row, Screen, Small } from "../../../src/ui/kit";

export default function Members() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, reload } = useLoad(() => api<CircleDetail>("GET", `/circles/${id}`), [id]);

  const block = async (userId: string, unblock: boolean) => {
    try { await api("POST", `/circles/${id}/block`, { userId, unblock }); await reload(); }
    catch (e) { notify("Couldn't update", (e as Error).message); }
  };
  const leave = async () => {
    if (!(await confirm("Leave this circle?", "You'll stop seeing its answers. Answers you shared stay unless you remove them first.", "Leave", true))) return;
    try { await api("POST", `/circles/${id}/leave`); router.dismissAll(); }
    catch (e) { notify("Couldn't leave", (e as Error).message); }
  };

  if (!data) return <Screen>{error ? <ErrorText message={error} /> : <Loading />}</Screen>;
  return (
    <Screen>
      <H2>{data.members.length} members</H2>
      <Small>Blocking hides a member's answers from you in this circle.</Small>
      {data.members.map((m) => (
        <Card key={m.id}>
          <Row>
            <P>{m.name}</P>
            {m.me ? <Pill text="You" /> : null}
            {m.blocked ? <Pill text="Blocked" tone="bad" /> : null}
          </Row>
          {!m.me ? <Button small kind="secondary" title={m.blocked ? "Unblock" : "Block"} onPress={() => { void block(m.id, m.blocked); }} /> : null}
        </Card>
      ))}
      <Button kind="danger" title="Leave circle" onPress={leave} />
    </Screen>
  );
}
