import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { clockIn, clockOut, getRooms, setRoomNotes } from "@/lib/sheets.functions";
import { STATUS_STYLES } from "./index";

export const Route = createFileRoute("/clean/$row")({
  head: () => ({
    meta: [{ title: "Rozpocznij sprzątanie — Apartamenty Pilice" }],
  }),
  component: CleanPage,
});

function CleanPage() {
  const { row } = Route.useParams();
  const rowNum = Number(row);
  const qc = useQueryClient();
  const fetchRooms = useServerFn(getRooms);
  const clockInFn = useServerFn(clockIn);
  const clockOutFn = useServerFn(clockOut);
  const saveNotesFn = useServerFn(setRoomNotes);

  const { data, isLoading } = useQuery({
    queryKey: ["rooms"],
    queryFn: () => fetchRooms(),
    refetchInterval: 20000,
  });
  const room = data?.rooms.find((r) => r.row === rowNum);

  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  useEffect(() => {
    if (room) setNotes(room.notes ?? "");
  }, [room?.row, room?.notes]);

  const clockInMut = useMutation({
    mutationFn: (cleanerName: string) =>
      clockInFn({ data: { row: rowNum, cleanerName } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rooms"] }),
  });
  const clockOutMut = useMutation({
    mutationFn: () => clockOutFn({ data: { row: rowNum } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rooms"] }),
  });
  const notesMut = useMutation({
    mutationFn: (n: string) => saveNotesFn({ data: { row: rowNum, notes: n } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rooms"] }),
  });

  const inProgress = room?.status === "Sprzątanie w toku";
  const done = room?.status === "Gotowe";

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-3 py-3 sm:px-4">
          <h1 className="text-base font-semibold text-neutral-900">Szczegóły pokoju</h1>
          <Link
            to="/"
            className="rounded-md border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
          >
            ← Wróć
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-md px-3 py-5 sm:px-4 sm:py-6 space-y-4">
        {isLoading && <p className="text-sm text-neutral-500">Ładowanie…</p>}
        {!isLoading && !room && (
          <p className="text-sm text-red-600">Nie znaleziono pokoju.</p>
        )}
        {room && (
          <>
            <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                {room.roomId && (
                  <span className="text-2xl font-bold text-neutral-900">
                    #{room.roomId}
                  </span>
                )}
                <span className="text-lg text-neutral-700">{room.roomName}</span>
              </div>
              <div className="mt-2">
                <span
                  className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[room.status] ?? "bg-neutral-100 text-neutral-700 border-neutral-200"}`}
                >
                  {room.status || "—"}
                </span>
              </div>
              <dl className="mt-4 space-y-1.5 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-neutral-500">Sprzątająca</dt>
                  <dd className="text-neutral-800">{room.cleanerName || "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-neutral-500">Ostatnia aktualizacja</dt>
                  <dd className="text-neutral-800">{room.timeStamp || "—"}</dd>
                </div>
                {room.startTime && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-neutral-500">Start</dt>
                    <dd className="text-neutral-800">{room.startTime}</dd>
                  </div>
                )}
                {room.endTime && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-neutral-500">Koniec</dt>
                    <dd className="text-neutral-800">{room.endTime}</dd>
                  </div>
                )}
                {room.totalTime && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-neutral-500">Czas pracy</dt>
                    <dd className="text-neutral-800">{room.totalTime}</dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
              {!inProgress && !done && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (name.trim()) clockInMut.mutate(name.trim());
                  }}
                  className="space-y-3"
                >
                  <label className="block text-sm font-medium text-neutral-700">
                    Twoje imię
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="np. Anna"
                    maxLength={80}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-base focus:border-neutral-900 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={clockInMut.isPending || !name.trim()}
                    className="w-full rounded-md bg-emerald-600 px-4 py-3 text-base font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {clockInMut.isPending ? "Rozpoczynanie…" : "Rozpocznij sprzątanie"}
                  </button>
                  {clockInMut.error && (
                    <p className="text-xs text-red-600">{(clockInMut.error as Error).message}</p>
                  )}
                </form>
              )}

              {inProgress && (
                <div className="space-y-3">
                  <p className="text-sm text-neutral-700">
                    Sprzątanie w toku{room.cleanerName ? ` — ${room.cleanerName}` : ""}.
                  </p>
                  <button
                    onClick={() => clockOutMut.mutate()}
                    disabled={clockOutMut.isPending}
                    className="w-full rounded-md bg-emerald-600 px-4 py-3 text-base font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {clockOutMut.isPending ? "Kończenie…" : "Zakończ sprzątanie"}
                  </button>
                  {clockOutMut.error && (
                    <p className="text-xs text-red-600">{(clockOutMut.error as Error).message}</p>
                  )}
                </div>
              )}

              {done && (
                <p className="text-sm text-emerald-700">
                  ✓ Pokój gotowy{room.cleanerName ? ` — sprzątała ${room.cleanerName}` : ""}.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
              <label className="block text-sm font-medium text-neutral-700">
                Notatki / komentarze
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={2000}
                rows={4}
                placeholder="Dodaj notatkę dla tego pokoju…"
                className="mt-2 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
              />
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => notesMut.mutate(notes)}
                  disabled={notesMut.isPending || notes === (room.notes ?? "")}
                  className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
                >
                  {notesMut.isPending ? "Zapisywanie…" : "Zapisz notatkę"}
                </button>
                {notesMut.isSuccess && notes === (room.notes ?? "") && (
                  <span className="text-xs text-emerald-600">Zapisano</span>
                )}
                {notesMut.error && (
                  <span className="text-xs text-red-600">
                    {(notesMut.error as Error).message}
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}