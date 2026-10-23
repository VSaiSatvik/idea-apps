import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { api } from "../../../src/lib/api";
import { ask, askDemo, connections, PROVIDERS, type Connection } from "../../../src/lib/providers";
import { providerLabel, type Topic } from "../../../src/lib/types";
import { Button, Card, Choice, ErrorText, Field, H2, P, Pill, Row, Screen, Small } from "../../../src/ui/kit";

type Search = { personal: boolean; matches: (Topic & { similarity: number })[] };

export default function Ask() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [q, setQ] = useState("");
  const [conns, setConns] = useState<Connection[]>([]);
  const [pick, setPick] = useState<string>("demo");
  const [search, setSearch] = useState<Search | null>(null);
  const [result, setResult] = useState<{ answer: string; model: string; provider: string } | null>(null);
  const [busy, setBusy] = useState<"search" | "ask" | "share" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void connections().then((c) => { setConns(c); if (c[0]) setPick(c[0].provider); });
  }, []);

  const check = async () => {
    setBusy("search"); setErr(null); setResult(null);
    try { setSearch(await api<Search>("POST", `/circles/${id}/search`, { question: q })); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(null); }
  };

  const askAi = async () => {
    setBusy("ask"); setErr(null);
    try {
      const c = conns.find((x) => x.provider === pick);
      const r = c ? await ask(c, q) : await askDemo(q);
      if (!r.answer) throw new Error("The AI returned an empty answer. Try again or rephrase.");
      setResult({ ...r, provider: c ? c.provider : "demo" });
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(null); }
  };

  const share = async () => {
    if (!result) return;
    setBusy("share"); setErr(null);
    try {
      await api("POST", `/circles/${id}/share`, { question: q, answer: result.answer, provider: result.provider, model: result.model });
      router.back();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(null); }
  };

  const options = [...conns.map((c) => ({ value: c.provider as string, label: providerLabel(c.provider) })), { value: "demo", label: "Demo" }];

  return (
    <Screen>
      <Field label="Your question" value={q} onChangeText={(v) => { setQ(v); setSearch(null); setResult(null); }} multiline placeholder="When is the CMP 333 milestone 2 due?" />
      {!search ? <Button title="Check the circle first" onPress={check} busy={busy === "search"} disabled={q.trim().length < 4} /> : null}

      {search?.personal ? (
        <Card><Pill text="Personal question" tone="accent" /><Small>Questions about your own email, calendar, grades or accounts have a different answer for everyone, so they're never shared. You can still ask your AI.</Small></Card>
      ) : null}

      {search && !search.personal && search.matches.length ? (
        <>
          <H2>Already answered in this circle</H2>
          {search.matches.map((m) => {
            const lead = m.pinned ?? m.answers.at(-1)!;
            return (
              <Card key={m.key} onPress={() => router.push(`/circle/${id}/topic/${m.key}`)}>
                <Row wrap>
                  {m.pinned ? <Pill text="Pinned" tone="good" /> : null}
                  {m.disagreement && !m.pinned ? <Pill text="AIs disagree" tone="warn" /> : null}
                </Row>
                <Small>{m.question}</Small>
                <P>{lead.answer.slice(0, 300)}{lead.answer.length > 300 ? "…" : ""}</P>
                <Small>{lead.authorName} · {providerLabel(lead.provider)}</Small>
              </Card>
            );
          })}
        </>
      ) : null}
      {search && !search.personal && !search.matches.length ? <Small>Nobody in the circle has asked this yet.</Small> : null}

      {search ? (
        <>
          <Choice label="Ask with" options={options} value={pick} onChange={setPick} />
          {pick === "demo" ? <Small>Demo answers are limited each day. Connect your own AI in Settings for unlimited questions.</Small> : null}
          {!conns.length ? <Button kind="ghost" small title="Connect Claude, ChatGPT or Gemini" onPress={() => router.push("/settings")} /> : null}
          <Button kind={search.matches.length ? "secondary" : "primary"} title={search.matches.length ? "Ask my AI anyway" : "Ask my AI"} onPress={askAi} busy={busy === "ask"} />
        </>
      ) : null}

      <ErrorText message={err} />

      {result ? (
        <Card>
          <Small>{pick === "demo" ? "Demo" : PROVIDERS[pick as keyof typeof PROVIDERS]?.label} · {result.model}</Small>
          <P selectable>{result.answer}</P>
          {search?.personal ? <Small>Personal questions can't be shared.</Small> : (
            <>
              <Small>Sharing adds this question and answer to the circle's library. Your API key is never shared.</Small>
              <Button title="Share with the circle" onPress={share} busy={busy === "share"} />
            </>
          )}
        </Card>
      ) : null}
    </Screen>
  );
}
