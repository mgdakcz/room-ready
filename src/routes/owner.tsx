import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  getRooms,
  setRoomStatus,
  setRoomNotes,
  verifyOwnerPin,
  STATUSES,
  type Room,
} from "@/lib/sheets.functions";

export const Route = createFileRoute("/owner")({
  head: () => ({
    meta: [
      { title: "Panel właściciela — Apartamenty Pilice" },
      { name: "description", content: "Owner control panel for room statuses." },
    ],
  }),
  component: OwnerPage,
});

const PIN_KEY = "apartamenty-owner-pin";

const STATUS_STYLES: Record<string, string> = {
  "Priorytet / do sprzątnięcia": "bg-red-100 text-red-800",
  "Wolne / do sprzątnięcia": "bg-amber-100 text-amber-800",
  "Sprzątanie w toku": "bg-blue-100 text-blue-800",
  Zajęte: "bg-neutral-200 text-neutral-700",
  Gotowe: "bg-emerald-100 text-emerald-800",
};

function OwnerPage() {
  const [pin, setPin] = useState<string | null>(null);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(PIN_KEY) : null;
    if (stored) setPin(stored);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem(PIN_KEY);
    setPin(null);
  };

  if (!pin) return <PinGate onUnlock={(p) => setPin(p)} />;
  return <Dashboard pin={pin} onLogout={handleLogout} />;
}

function PinGate({ onUnlock }: { onUnlock: (pin: string) => void }) {
  const verifyFn = useServerFn(verifyOwnerPin);
  const [value, setValue] = useState("");
  const [err, setErr] = useState("");
  const mut = useMutation({
    mutationFn: (p: string) => verifyFn({ data: { pin: p } }),
    onSuccess: (res, p) => {
      if (res.ok) {
        localStorage.setItem(PIN_KEY, p);
        onUnlock(p);
      } else {
        setErr("Nieprawidłowy PIN");
      }
    },
    onError: (e) => setErr((e as Error).message),
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setErr("");
          if (value) mut.mutate(value);
        }}
        className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-6 shadow-sm"
      >
        <h1 className="text-lg font-semibold text-neutral-900">Panel właściciela</h1>
        <p className="mt-1 text-sm text-neutral-500">Wprowadź PIN, aby kontynuować.</p>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="PIN"
          maxLength={32}
          className="mt-4 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
        />
        {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
        <button
          type="submit"
          disabled={mut.isPending || !value}
          className="mt-4 w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {mut.isPending ? "Sprawdzanie…" : "Zaloguj"}
        </button>
        <div className="mt-4 text-center">
          <Link to="/" className="text-xs text-neutral-500 hover:text-neutral-900">
            ← Wróć do widoku sprzątaczek
          </Link>
        </div>
      </form>
    </div>
  );
}

function Dashboard({ pin, onLogout }: { pin: string; onLogout: () => void }) {
  const fetchRooms = useServerFn(getRooms);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["rooms"],
    queryFn: () => fetchRooms(),
    refetchInterval: 20000,
  });
  const allRooms = data?.rooms ?? [];
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const q = query.trim().toLowerCase();
  const rooms = allRooms.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (!q) return true;
    return (
      r.roomName.toLowerCase().includes(q) ||
      r.roomId.toLowerCase().includes(q) ||
      r.cleanerName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-base font-semibold text-neutral-900">Panel właściciela</h1>
            <p className="text-xs text-neutral-500">Apartamenty Pilice</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="rounded-md border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
              disabled={isFetching}
            >
              {isFetching ? "..." : "Odśwież"}
            </button>
            <Link
              to="/"
              className="rounded-md border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
            >
              Widok sprzątaczek
            </Link>
            <button
              onClick={onLogout}
              className="rounded-md px-2.5 py-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900"
            >
              Wyloguj
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5 space-y-3">
        <div className="space-y-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj pokoju, numeru lub osoby…"
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
          />
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setStatusFilter("all")}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                statusFilter === "all"
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100"
              }`}
            >
              Wszystkie ({allRooms.length})
            </button>
            {STATUSES.map((s) => {
              const count = allRooms.filter((r) => r.status === s).length;
              if (count === 0) return null;
              const active = statusFilter === s;
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                    active
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100"
                  }`}
                >
                  {s} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {isLoading && <p className="text-sm text-neutral-500">Ładowanie pokoi…</p>}
        {error && (
          <p className="text-sm text-red-600">
            Błąd: {(error as Error).message}
          </p>
        )}
        {!isLoading && rooms.length === 0 && allRooms.length > 0 && (
          <p className="text-sm text-neutral-500">Brak pokoi pasujących do filtra.</p>
        )}
        <div className="space-y-2">
          {rooms.map((room) => (
            <OwnerRoomRow key={room.row} room={room} pin={pin} />
          ))}
        </div>
      </main>
    </div>
  );
}

function OwnerRoomRow({ room, pin }: { room: Room; pin: string }) {
  const qc = useQueryClient();
  const setStatusFn = useServerFn(setRoomStatus);
  const setNotesFn = useServerFn(setRoomNotes);
  const mut = useMutation({
    mutationFn: (status: (typeof STATUSES)[number]) =>
      setStatusFn({ data: { row: room.row, status, pin } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rooms"] }),
  });
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState(room.notes);
  const notesMut = useMutation({
    mutationFn: (n: string) => setNotesFn({ data: { row: room.row, notes: n } }),
    onSuccess: () => {
      setNotesOpen(false);
      qc.invalidateQueries({ queryKey: ["rooms"] });
    },
  });

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-neutral-900">
            {room.roomId && (
              <span className="mr-1.5 text-xs font-semibold text-neutral-400">
                #{room.roomId}
              </span>
            )}
            {room.roomName}
          </p>
          {room.timeStamp && (
            <p className="mt-0.5 text-[11px] text-neutral-400">
              Aktualizacja: {room.timeStamp}
            </p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`rounded-full px-2 py-0.5 font-medium ${STATUS_STYLES[room.status] ?? "bg-neutral-100 text-neutral-700"}`}
            >
              {room.status || "—"}
            </span>
            {room.cleanerName && (
              <span className="text-neutral-500">{room.cleanerName}</span>
            )}
            {room.totalTime && <span className="text-neutral-400">{room.totalTime}</span>}
          </div>
        </div>
        <select
          value={room.status}
          disabled={mut.isPending}
          onChange={(e) => mut.mutate(e.target.value as (typeof STATUSES)[number])}
          className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs text-neutral-800 focus:border-neutral-900 focus:outline-none disabled:opacity-50"
        >
          {!STATUSES.includes(room.status as never) && room.status && (
            <option value={room.status}>{room.status}</option>
          )}
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {!notesOpen ? (
        <div className="mt-2 flex items-start gap-2">
          <p className="flex-1 text-xs text-neutral-500">
            {room.notes ? (
              <span className="whitespace-pre-wrap">📝 {room.notes}</span>
            ) : (
              <span className="text-neutral-400">Brak notatek</span>
            )}
          </p>
          <button
            onClick={() => {
              setNotes(room.notes);
              setNotesOpen(true);
            }}
            className="shrink-0 rounded-md border border-neutral-200 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100"
          >
            {room.notes ? "Edytuj" : "Dodaj notatkę"}
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            notesMut.mutate(notes);
          }}
          className="mt-2 space-y-2"
        >
          <textarea
            autoFocus
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={2000}
            rows={3}
            className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm focus:border-neutral-900 focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={notesMut.isPending}
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {notesMut.isPending ? "Zapisywanie…" : "Zapisz"}
            </button>
            <button
              type="button"
              onClick={() => setNotesOpen(false)}
              className="rounded-md border border-neutral-200 px-2.5 py-1.5 text-xs text-neutral-600"
            >
              Anuluj
            </button>
            {notesMut.error && (
              <span className="self-center text-xs text-red-600">
                {(notesMut.error as Error).message}
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}