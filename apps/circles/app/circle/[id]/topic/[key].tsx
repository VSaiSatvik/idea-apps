import { useLocalSearchParams } from "expo-router";
import { api } from "../../../../src/lib/api";
import { providerLabel, type CircleDetail } from "../../../../src/lib/types";
import { useLoad } from "../../../../src/lib/useLoad";
import { confirm, notify } from "../../../../src/ui/confirm";
import { Button, Card, ErrorText, H2, Loading, P, Pill, Row, Screen, Small } from "../../../../src/ui/kit";

export default function TopicScreen() {
  const { id, key } = useLocalSearchParams<{ id: string; key: string }>();
  const { data, error, loading, reload } = useLoad(() => api<CircleDetail>("GET", `/circles/${id}`), [id, key]);
  const topic = data?.topics.find((t) => t.key === key);

  const pin = async (entryId: string) => {
    try { await api("POST", `/circles/${id}/pin`, { topicKey: key, entryId }); await reload(); }
    catch (e) { notify("Couldn't pin", (e as Error).message); }
  };
  const report = async (entryId: string) => {
    if (!(await confirm("Report this answer?", "Reported answers are hidden once two members report them (or the circle owner reports once).", "Report", true))) return;
    try { await api("POST", `/circles/${id}/entries/${entryId}/report`, { reason: "inappropriate" }); notify("Thanks — reported."); await reload(); }
    catch (e) { notify("Couldn't report", (e as Error).message); }
  };
  const remove = async (entryId: string) => {
    if (!(await confirm("Remove this answer?", "It will be removed from the circle for everyone.", "Remove", true))) return;
    try { await api("DELETE", `/circles/${id}/entries/${entryId}`); await reload(); }
    catch (e) { notify("Couldn't remove", (e as Error).message); }
  };

  if (!data) return <Screen>{error ? <ErrorText message={error} /> : <Loading />}</Screen>;
  if (!topic) return <Screen><P>This topic was removed.</P></Screen>;

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <H2>{topic.question}</H2>
      {topic.disagreement ? (
        <Card>
          <Pill text="AIs disagree" tone="warn" />
          <Small>{topic.disagreement.note}</Small>
          {topic.disagreement.variants.map((v) => <Small key={v}>• {v}</Small>)}
        </Card>
      ) : null}
      {topic.answers.map((a) => {
        const pinned = topic.pinned?.id === a.id;
        return (
          <Card key={a.id}>
            <Row wrap>
              {pinned ? <Pill text="Pinned" tone="good" /> : null}
              <Small>{a.authorName} · {providerLabel(a.provider)}{a.model ? ` · ${a.model}` : ""}</Small>
            </Row>
            {a.question !== topic.question ? <Small>Asked as: {a.question}</Small> : null}
            <P selectable>{a.answer}</P>
            <Row wrap>
              {!pinned ? <Button small kind="secondary" title="Pin as checked" onPress={() => { void pin(a.id); }} /> : null}
              {a.mine || data.owner ? <Button small kind="ghost" title="Remove" onPress={() => { void remove(a.id); }} /> : null}
              {!a.mine ? <Button small kind="ghost" title="Report" onPress={() => { void report(a.id); }} /> : null}
            </Row>
          </Card>
        );
      })}
      <Small>Pin the answer you've checked against a source (a syllabus, an official page). Pinned answers show first for everyone.</Small>
    </Screen>
  );
}
