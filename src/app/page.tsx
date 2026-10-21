export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-6 py-24">
      <h1 className="text-3xl font-semibold tracking-tight">Tenet</h1>
      <p className="text-zinc-600">
        Paste an AI policy, pick an agent to test, and watch where its behavior departs from the policy. The
        policies page lands here on Thursday; until then, use the CLI: <code className="font-mono">npm run tenet -- policies</code>.
      </p>
    </main>
  );
}
