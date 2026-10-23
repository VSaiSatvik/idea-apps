import { router, Stack } from "expo-router";
import { api } from "../src/lib/api";
import { aed, type Invoice } from "../src/lib/types";
import { useLoad } from "../src/lib/useLoad";
import { Button, Card, Empty, ErrorText, H1, P, Row, Screen, Small } from "../src/ui/kit";
import { StatusPill } from "../src/ui/StatusPill";

export default function Invoices() {
  const { data, error, loading, reload } = useLoad(() => api<Invoice[]>("GET", "/wasl/invoices"));
  const open = data?.filter((i) => i.status !== "paid") ?? [];
  const owed = open.reduce((s, i) => s + i.amountAED, 0);

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Stack.Screen options={{ headerRight: () => <Button small kind="ghost" title="Account" onPress={() => router.push("/account")} /> }} />
      <H1>Invoices</H1>
      {data?.length ? <P muted>{open.length} open · {aed(owed)} outstanding</P> : null}
      <Button title="New invoice" onPress={() => router.push("/new")} />
      <ErrorText message={error} />
      {data && !data.length ? (
        <Empty title="No invoices yet" body="Create an invoice and send your client the confirmation link. Once they tap confirm, you have written proof of the debt." />
      ) : null}
      {data?.map((inv) => (
        <Card key={inv.id} onPress={() => router.push(`/invoice/${inv.id}`)}>
          <Row wrap><StatusPill inv={inv} /><Small>#{inv.number}</Small></Row>
          <P>{inv.debtor.name} · {aed(inv.amountAED)}</P>
          <Small>Due {inv.dueOn} · evidence {inv.evidence.strength}</Small>
        </Card>
      ))}
    </Screen>
  );
}
