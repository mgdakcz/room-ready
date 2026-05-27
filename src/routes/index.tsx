import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { clockIn, clockOut, getRooms, setRoomNotes, type Room } from "@/lib/sheets.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Apartamenty Pilice Tracker" },
      { name: "description", content: "Track cleaning progress across rooms in real time." },
      { property: "og:title", content: "Apartamenty Pilice Tracker" },
      { property: "og:description", content: "Track cleaning progress across rooms in real time." },
    ],
  }),
  component: Index,
});

const STATUS_ORDER = [
  "Priorytet / do sprzątnięcia",
  "Wolne / do sprzątnięcia",
  "Sprzątanie w toku",
  "Zajęte",
  "Gotowe",
] as const;

const STATUS_STYLES: Record<string, string> = {
  "Priorytet / do sprzątnięcia": "bg-red-100 text-red-800 border-red-200",
  "Wolne / do sprzątnięcia": "bg-amber-100 text-amber-800 border-amber-200",
  "Sprzątanie w toku": "bg-blue-100 text-blue-800 border-blue-200",
  Zajęte: "bg-neutral-200 text-neutral-700 border-neutral-300",
  Gotowe: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

function Index() {
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
  const grouped = STATUS_ORDER.map((s) => ({
    status: s,
    rooms: rooms.filter((r) => r.status === s),
  })).filter((g) => g.rooms.length > 0);
  const other = rooms.filter((r) => !STATUS_ORDER.includes(r.status as never));

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-base font-semibold text-neutral-900">Apartamenty Pilice</h1>
            <p className="text-xs text-neutral-500">Tracker sprzątania</p>
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
              to="/owner"
              className="rounded-md bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
            >
              Owner
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5 space-y-6">
        <div className="space-y-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj pokoju, numeru lub osoby…"
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
          />
          <div className="flex flex-wrap gap-1.5">
            <FilterChip active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>
              Wszystkie ({allRooms.length})
            </FilterChip>
            {STATUS_ORDER.map((s) => {
              const count = allRooms.filter((r) => r.status === s).length;
              if (count === 0) return null;
              return (
                <FilterChip
                  key={s}
                  active={statusFilter === s}
                  onClick={() => setStatusFilter(s)}
                >
                  {s} ({count})
                </FilterChip>
              );
            })}
          </div>
        </div>

        {isLoading && <p className="text-sm text-neutral-500">Ładowanie pokoi…</p>}
        {error && (
          <p className="text-sm text-red-600">
            Nie udało się wczytać pokoi: {(error as Error).message}
          </p>
        )}
        {!isLoading && rooms.length === 0 && allRooms.length > 0 && (
          <p className="text-sm text-neutral-500">Brak pokoi pasujących do filtra.</p>
        )}
        {grouped.map((g) => (
          <section key={g.status}>
            <div className="mb-2 flex items-center gap-2">
              <span
                className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[g.status] ?? ""}`}
              >
                {g.status}
              </span>
              <span className="text-xs text-neutral-400">{g.rooms.length}</span>
            </div>
            <ul className="space-y-2">
              {g.rooms.map((room) => (
                <RoomCard key={room.row} room={room} />
              ))}
            </ul>
          </section>
        ))}
        {other.length > 0 && (
          <section>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
              Inne
            </div>
            <ul className="space-y-2">
              {other.map((room) => (
                <RoomCard key={room.row} room={room} />
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
        active
          ? "border-neutral-900 bg-neutral-900 text-white"
          : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100"
      }`}
    >
      {children}
    </button>
  );
}

function RoomCard({ room }: { room: Room }) {
  const qc = useQueryClient();
  const clockInFn = useServerFn(clockIn);
  const clockOutFn = useServerFn(clockOut);
  const [name, setName] = useState("");
  const [expand, setExpand] = useState(false);

  const clockInMut = useMutation({
    mutationFn: (cleanerName: string) =>
      clockInFn({ data: { row: room.row, cleanerName } }),
    onSuccess: () => {
      setName("");
      setExpand(false);
      qc.invalidateQueries({ queryKey: ["rooms"] });
    },
  });

  const clockOutMut = useMutation({
    mutationFn: () => clockOutFn({ data: { row: room.row } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rooms"] }),
  });

  const inProgress = room.status === "Sprzątanie w toku";
  const claimable =
    room.status === "Wolne / do sprzątnięcia" ||
    room.status === "Priorytet / do sprzątnięcia";

  return (
    <li className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
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
          {inProgress && room.cleanerName && (
            <p className="mt-0.5 text-xs text-blue-700">
              Sprząta: <span className="font-medium">{room.cleanerName}</span>
              {room.startTime && <> · od {room.startTime.slice(11)}</>}
            </p>
          )}
          {!inProgress && room.cleanerName && room.totalTime && (
            <p className="mt-0.5 text-xs text-neutral-500">
              Ostatnio: {room.cleanerName} · {room.totalTime}
            </p>
          )}
        </div>
        <div className="shrink-0">
          {claimable && !expand && (
            <button
              onClick={() => setExpand(true)}
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
            >
              Start
            </button>
          )}
          {inProgress && (
            <button
              onClick={() => clockOutMut.mutate()}
              disabled={clockOutMut.isPending}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {clockOutMut.isPending ? "..." : "Zakończ"}
            </button>
          )}
        </div>
      </div>

      {claimable && expand && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) clockInMut.mutate(name.trim());
          }}
          className="mt-3 flex gap-2"
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Twoje imię"
            maxLength={80}
            className="flex-1 rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm focus:border-neutral-900 focus:outline-none"
          />
          <button
            type="submit"
            disabled={clockInMut.isPending || !name.trim()}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {clockInMut.isPending ? "..." : "Rozpocznij"}
          </button>
          <button
            type="button"
            onClick={() => {
              setExpand(false);
              setName("");
            }}
            className="rounded-md border border-neutral-200 px-2.5 py-1.5 text-sm text-neutral-600"
          >
            Anuluj
          </button>
        </form>
      )}

      {(clockInMut.error || clockOutMut.error) && (
        <p className="mt-2 text-xs text-red-600">
          {((clockInMut.error || clockOutMut.error) as Error).message}
        </p>
      )}

      <NotesEditor row={room.row} initial={room.notes} />
    </li>
  );
}

function NotesEditor({ row, initial }: { row: number; initial: string }) {
  const qc = useQueryClient();
  const saveFn = useServerFn(setRoomNotes);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(initial);

  const mut = useMutation({
    mutationFn: (notes: string) => saveFn({ data: { row, notes } }),
    onSuccess: () => {
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["rooms"] });
    },
  });

  if (!open) {
    return (
      <div className="mt-2 flex items-start gap-2">
        <p className="flex-1 text-xs text-neutral-500">
          {initial ? (
            <span className="whitespace-pre-wrap">📝 {initial}</span>
          ) : (
            <span className="text-neutral-400">Brak notatek</span>
          )}
        </p>
        <button
          onClick={() => {
            setValue(initial);
            setOpen(true);
          }}
          className="shrink-0 rounded-md border border-neutral-200 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100"
        >
          {initial ? "Edytuj" : "Dodaj notatkę"}
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mut.mutate(value);
      }}
      className="mt-2 space-y-2"
    >
      <textarea
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={2000}
        rows={3}
        placeholder="Notatka dla tego pokoju…"
        className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm focus:border-neutral-900 focus:outline-none"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={mut.isPending}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {mut.isPending ? "Zapisywanie…" : "Zapisz"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-neutral-200 px-2.5 py-1.5 text-xs text-neutral-600"
        >
          Anuluj
        </button>
        {mut.error && (
          <span className="self-center text-xs text-red-600">
            {(mut.error as Error).message}
          </span>
        )}
      </div>
    </form>
  );
}
