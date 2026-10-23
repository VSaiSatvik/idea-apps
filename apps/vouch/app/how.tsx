import { Card, H2, P, Screen, Small } from "../src/ui/kit";

const steps = [
  ["We group neighbours", "3–4 venues within a short walk that don't compete (a coffee shop, a bakery, a brunch place, a dessert spot)."],
  ["You each confirm a slot", "Each venue pays a small base fee for the crawl."],
  ["A verified creator films one crawl", "Only creators with a UAE advertiser permit on file are booked. They visit every stop and post one video with each venue's own code on screen."],
  ["Customers show the code", "Staff enter the code and the last 3 digits of the customer's phone in the Till screen. Each customer counts once."],
  ["Pay for real visits", "After 14 days each venue pays per verified visit (capped), and sees exactly how many customers the crawl brought."],
];

export default function How() {
  return (
    <Screen>
      {steps.map(([t, b], i) => (
        <Card key={t}>
          <H2>{i + 1}. {t}</H2>
          <P muted>{b}</P>
        </Card>
      ))}
      <Small>Payments are handled by our payment partner; Vouch Crawls doesn't store card details.</Small>
    </Screen>
  );
}
