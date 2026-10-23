import { router, Stack } from "expo-router";
import { api } from "../src/lib/api";
import { stateLabel, stateTone, type Me } from "../src/lib/types";
import { useLoad } from "../src/lib/useLoad";
import { Button, Card, Empty, ErrorText, H1, H2, Loading, P, Pill, Row, Screen, Small } from "../src/ui/kit";

export default function Home() {
  const { data, error, loading, reload } = useLoad(() => api<Me>("GET", "/vouch/me"));
  if (!data) return <Screen>{error ? <ErrorText message={error} /> : <Loading />}</Screen>;
  const isVenue = data.venues.length > 0;
  const isCreator = !!data.creator;

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Stack.Screen options={{ headerRight: () => <Button small kind="ghost" title="Account" onPress={() => router.push("/account")} /> }} />
      <H1>Hi there</H1>
      {!isVenue && !isCreator ? (
        <>
          <P muted>Are you a café or restaurant, or a local creator?</P>
          <Card onPress={() => router.push("/venue-new")}>
            <P>I run a venue</P>
            <Small>Join a crawl with 2–3 neighbours. AED {data.pricing.venueSlotBaseAED} per crawl plus AED {data.pricing.venuePerVisitAED} for each customer who shows your code.</Small>
          </Card>
          <Card onPress={() => router.push("/creator")}>
            <P>I'm a creator</P>
            <Small>Get paid AED {data.pricing.creatorBaseAED} per crawl video plus AED {data.pricing.creatorPerVisitAED} per verified visit. A UAE advertiser permit is required.</Small>
          </Card>
          <Button kind="ghost" title="How crawls work" onPress={() => router.push("/how")} />
        </>
      ) : null}

      {isVenue ? (
        <>
          <H2>Your venues</H2>
          {data.venues.map((v) => <Card key={v.id}><P>{v.name}</P><Small>{v.area} · {v.category} · {v.opens}:00–{v.closes}:00</Small></Card>)}
          <Button title="Till: check a customer's code" onPress={() => router.push("/till")} />
          <Button kind="secondary" title="Add another venue" onPress={() => router.push("/venue-new")} />
        </>
      ) : null}

      {isCreator ? (
        <Card onPress={() => router.push("/creator")}>
          <Row><H2>{data.creator!.handle}</H2><Pill text={data.creator!.permit.ok ? "Permit verified" : "Permit not verified"} tone={data.creator!.permit.ok ? "good" : "warn"} /></Row>
          <Small>{data.creator!.followers.toLocaleString()} followers · {data.creator!.permit.reason}</Small>
        </Card>
      ) : null}

      {(isVenue || isCreator || data.admin) ? <H2>Crawls</H2> : null}
      {(isVenue || isCreator) && !data.crawls.length ? <Empty title="No crawls yet" body="We'll group you with nearby venues and add you to the next crawl in your area." /> : null}
      {data.crawls.map((c) => (
        <Card key={c.id} onPress={() => router.push(`/crawl/${c.id}`)}>
          <Row wrap><Pill text={stateLabel[c.state]} tone={stateTone[c.state]} /><Small>{c.walkKm} km walk</Small></Row>
          <P>{c.stops.map((s) => s.name).join(" → ")}</P>
          {c.creator ? <Small>Creator {c.creator.handle}</Small> : null}
        </Card>
      ))}
      {data.admin ? <Button kind="secondary" title="Organiser tools" onPress={() => router.push("/admin")} /> : null}
    </Screen>
  );
}
