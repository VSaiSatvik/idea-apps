import { router, Stack, useLocalSearchParams } from "expo-router";
import { Share } from "react-native";
import { api } from "../../../src/lib/api";
import { providerLabel, type CircleDetail } from "../../../src/lib/types";
import { useLoad } from "../../../src/lib/useLoad";
import { Button, Card, Empty, ErrorText, H1, Loading, P, Pill, Row, Screen, Small } from "../../../src/ui/kit";

export default function CircleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, loading, reload } = useLoad(() => api<CircleDetail>("GET", `/circles/${id}`), [id]);

  const invite = () =>
    data && Share.share({ message: `Join my AskOnce Circles group "${data.name}" — invite code ${data.inviteCode}` });

  if (!data) return <Screen>{error ? <ErrorText message={error} /> : <Loading />}</Screen>;
  const flagged = data.topics.filter((t) => t.disagreement && !t.pinned).length;

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Stack.Screen options={{ title: data.name, headerRight: () => <Button small kind="ghost" title="Members" onPress={() => router.push(`/circle/${id}/members`)} /> }} />
      <H1>{data.name}</H1>
      <Row wrap>
        <Small>{data.members.length} {data.members.length === 1 ? "member" : "members"} · invite code {data.inviteCode}</Small>
      </Row>
      <Row>
        <Button title="Ask a question" onPress={() => router.push(`/circle/${id}/ask`)} />
        <Button kind="secondary" title="Invite" onPress={() => { void invite(); }} />
      </Row>
      {flagged ? (
        <Card>
          <Pill text={`${flagged} to check`} tone="warn" />
          <Small>Members' AIs disagreed on these. Open one, check a source, and pin the right answer.</Small>
        </Card>
      ) : null}
      <ErrorText message={error} />
      {!data.topics.length ? <Empty title="No shared answers yet" body="Ask a question. When you get a good answer, share it so the circle doesn't have to ask again." /> : null}
      {data.topics.map((t) => {
        const lead = t.pinned ?? t.answers.at(-1)!;
        return (
          <Card key={t.key} onPress={() => router.push(`/circle/${id}/topic/${t.key}`)}>
            <Row wrap>
              {t.pinned ? <Pill text="Pinned" tone="good" /> : null}
              {t.disagreement && !t.pinned ? <Pill text="AIs disagree" tone="warn" /> : null}
              <Small>{t.answers.length} {t.answers.length === 1 ? "answer" : "answers"}</Small>
            </Row>
            <P>{t.question}</P>
            <Small>{lead.answer.slice(0, 160)}{lead.answer.length > 160 ? "…" : ""}</Small>
            <Small>{lead.authorName} · {providerLabel(lead.provider)}</Small>
          </Card>
        );
      })}
    </Screen>
  );
}
