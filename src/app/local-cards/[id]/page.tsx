/* eslint-disable @next/next/no-img-element -- Saved card PNGs are served by a local API route. */

import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocalCardRecord } from "@/lib/local-card-db";

interface LocalCardPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function LocalCardPage({ params }: LocalCardPageProps) {
  const { id } = await params;
  const record = getLocalCardRecord(id);

  if (!record) {
    notFound();
  }

  return (
    <main className="min-h-screen px-4 py-5 text-[var(--gc-black)] sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-4">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--gc-black)]/18 bg-[var(--gc-sand)]/90 py-3">
          <div>
            <h1 className="text-xl font-black tracking-normal text-[var(--gc-black)]">Saved card</h1>
            <p className="text-sm font-semibold text-[var(--gc-gray)]">CardifyBooth local print file</p>
          </div>
          <Link
            href="/"
            className="rounded-[6px] border border-[var(--gc-black)]/22 bg-white px-3 py-2 text-sm font-bold text-[var(--gc-black)] transition hover:bg-[var(--gc-alabaster)]"
          >
            Create another
          </Link>
        </header>

        <section className="grid gap-5 rounded-[8px] border border-[var(--gc-black)]/14 bg-[#ffffff] p-4 lg:grid-cols-[minmax(280px,460px)_1fr] lg:items-start">
          <div className="rounded-[6px] border border-[var(--gc-black)]/12 bg-white p-3">
            <img
              src={`/api/local-cards/${record.id}/image`}
              alt={`${record.displayName} generated CardifyBooth card`}
              className="w-full rounded-[6px] border border-[var(--gc-black)]/10 bg-white"
            />
          </div>

          <div className="grid gap-4">
            <div className="border-b border-[var(--gc-black)]/12 pb-3">
              <h2 className="text-2xl font-black tracking-normal text-[var(--gc-black)]">
                {record.displayName}
              </h2>
              <p className="mt-1 text-sm font-semibold text-[var(--gc-orange)]">{record.rarity}</p>
              <p className="mt-3 text-base font-semibold leading-7 text-[var(--gc-gray)]">
                Known for {record.knownFor}.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[6px] border border-[var(--gc-black)]/12 bg-white p-3">
                <p className="text-sm font-bold text-[var(--gc-gray)]">
                  Campus Power
                </p>
                <p className="mt-1 font-mono text-3xl font-black leading-none text-[var(--gc-black)]">
                  {record.campusPower}
                </p>
              </div>
              <div className="rounded-[6px] border border-[var(--gc-black)]/12 bg-white p-3">
                <p className="text-sm font-bold text-[var(--gc-gray)]">
                  Print Status
                </p>
                <p className="mt-2 font-bold text-[var(--gc-blue)]">
                  {record.printStatus.replaceAll("_", " ")}
                </p>
              </div>
            </div>

            <div className="rounded-[6px] border border-[var(--gc-black)]/12 bg-white p-3">
              <p className="text-sm font-bold text-[var(--gc-gray)]">
                Trait Scores
              </p>
              <div className="mt-3 grid gap-2">
                {Object.entries(record.traitScores).map(([trait, score]) => (
                  <div key={trait}>
                    <div className="flex items-center justify-between gap-3 text-sm font-black">
                      <span>{trait}</span>
                      <span className="font-mono">{score}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#d8d8d8]">
                      <div className="h-full rounded-full bg-[var(--gc-blue)]" style={{ width: `${score}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <dl className="grid gap-3 text-sm">
              <div className="rounded-[6px] border border-[var(--gc-black)]/12 bg-white p-3">
                <dt className="font-bold text-[var(--gc-gray)]">
                  Card ID
                </dt>
                <dd className="mt-1 break-all font-semibold text-[var(--gc-black)]">{record.id}</dd>
              </div>
              <div className="rounded-[6px] border border-[var(--gc-black)]/12 bg-white p-3">
                <dt className="font-bold text-[var(--gc-gray)]">
                  Expires
                </dt>
                <dd className="mt-1 font-semibold text-[var(--gc-black)]">
                  {new Date(record.expiresAt).toLocaleString()}
                </dd>
              </div>
            </dl>
          </div>
        </section>
      </div>
    </main>
  );
}
