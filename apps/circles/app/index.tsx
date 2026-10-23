import { router, Stack } from "expo-router";
import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { api } from "../src/lib/api";
import { connections } from "../src/lib/providers";
import { useLoad } from "../src/lib/useLoad";
import { Button, Card, Empty, ErrorText, H1, P, Pill, Row, Screen, Small } from "../src/ui/kit";

type CircleRow = { id: string; name: string; members: number; answers: number; owner: boolean };

export default function Home() {
  const { data, error, loading, reload } = useLoad(() => api<CircleRow[]>("GET", "/circles"));
  const [aiCount, setAiCount] = useState<number | null>(null);
  useFocusEffect(useCallback(() => { void connections().then((c) => setAiCount(c.length)); }, []));

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Stack.Screen options={{ headerRight: () => <Button small kind="ghost" title="Account" onPress={() => router.push("/account")} /> }} />
      <H1>Your circles</H1>
      {aiCount === 0 ? (
        <Card onPress={() => router.push("/settings")}>
          <Pill text="Set up" tone="warn" />
          <P>Connect your AI</P>
          <Small>Add your Claude, ChatGPT or Gemini API key so your questions go to your own AI. Until then you can try demo answers.</Small>
        </Card>
      ) : (
        <Button kind="secondary" title={`Your AI (${aiCount ?? "…"} connected)`} onPress={() => router.push("/settings")} />
      )}
      <ErrorText message={error} />
      {data && !data.length ? (
        <Empty title="No circles yet" body="Start one for your study group, team or family, or join with an invite code." />
      ) : null}
      {data?.map((c) => (
        <Card key={c.id} onPress={() => router.push(`/circle/${c.id}`)}>
          <P>{c.name}</P>
          <Row wrap>
            <Small>{c.members} {c.members === 1 ? "member" : "members"}</Small>
            <Small>· {c.answers} shared {c.answers === 1 ? "answer" : "answers"}</Small>
            {c.owner ? <Pill text="Owner" /> : null}
          </Row>
        </Card>
      ))}
      <Button title="Start a circle" onPress={() => router.push("/new")} />
      <Button kind="secondary" title="Join with a code" onPress={() => router.push("/join")} />
    </Screen>
  );
}
