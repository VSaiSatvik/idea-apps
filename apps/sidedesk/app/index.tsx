import { router, Stack } from "expo-router";
import { api } from "../src/lib/api";
import { statusLabel, statusTone, type Me } from "../src/lib/types";
import { useLoad } from "../src/lib/useLoad";
import { Button, Card, ErrorText, H1, H2, Loading, P, Pill, Row, Screen, Small } from "../src/ui/kit";

export default function Home() {
  const { data, error, loading, reload } = useLoad(() => api<Me>("GET", "/sidedesk/me"));
  if (!data) return <Screen>{error ? <ErrorText message={error} /> : <Loading />}</Screen>;
  const s = data.student;

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Stack.Screen options={{ headerRight: () => <Button small kind="ghost" title="Account" onPress={() => router.push("/account")} /> }} />
      <H1>SideDesk</H1>

      <H2>Get small jobs done</H2>
      <P muted>Data entry, lead lists, transcription, proofreading and more — fixed prices, done by verified university students, checked before delivery.</P>
      <Button title="Order a task" onPress={() => router.push("/order-new")} />
      {data.orders.map((o) => (
        <Card key={o.id} onPress={() => router.push(`/order/${o.id}`)}>
          <Row wrap><Pill text={statusLabel[o.status]} tone={statusTone(o.status)} /><Small>AED {o.priceAED}</Small></Row>
          <P>{o.title}</P>
          <Small>{o.brief.slice(0, 90)}{o.brief.length > 90 ? "…" : ""}</Small>
        </Card>
      ))}

      <H2>Earn as a student</H2>
      {!s ? (
        <Card onPress={() => router.push("/student")}>
          <P>Join the student waitlist</P>
          <Small>Paid hourly for small remote tasks between classes. 18+, with a university email.</Small>
        </Card>
      ) : s.active ? (
        <Card onPress={() => router.push("/board")}>
          <Row><Pill text="Active" tone="good" /><Small>AED {Math.round(s.earnedAED)} earned</Small></Row>
          <P>Open the task board</P>
        </Card>
      ) : (
        <Card onPress={() => router.push("/student")}>
          <Pill text="On the waitlist" tone="warn" />
          <Small>We activate students (and file your work permit) when there's enough work for your skills. You'll see the task board here once you're active.</Small>
        </Card>
      )}
      {data.admin ? <Button kind="secondary" title="Operations" onPress={() => router.push("/admin")} /> : null}
    </Screen>
  );
}
