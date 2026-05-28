import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getRooms, type Room } from "@/lib/sheets.functions";

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

const STATUS_FILTERS = [
  "Priorytet / do sprzątnięcia",
  "Wolne / do sprzątnięcia",
  "Sprzątanie w toku",
  "Zajęte",
  "Gotowe",
] as const;

export const STATUS_STYLES: Record<string, string> = {
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
    return r.roomId.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-3 py-3 sm:max-w-xl sm:px-4">
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

      <main className="mx-auto max-w-md px-3 py-4 space-y-4 sm:max-w-xl sm:px-4 sm:py-5">
        <div className="space-y-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj numeru pokoju…"
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base focus:border-neutral-900 focus:outline-none sm:text-sm"
          />
          <div className="flex flex-wrap gap-1.5">
            <FilterChip active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>
              Wszystkie ({allRooms.length})
            </FilterChip>
            {STATUS_FILTERS.map((s) => {
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
        {rooms.length > 0 && (
          <ul className="space-y-2">
            {rooms.map((room) => (
              <RoomRow key={room.row} room={room} />
            ))}
          </ul>
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

function RoomRow({ room }: { room: Room }) {
  return (
    <li>
      <Link
        to="/clean/$row"
        params={{ row: String(room.row) }}
        className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm transition active:bg-neutral-50 hover:border-neutral-300"
      >
        {room.roomId && (
          <span className="shrink-0 text-lg font-bold leading-none text-neutral-900 tabular-nums">
            #{room.roomId}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-800">
          {room.roomName}
        </span>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[room.status] ?? "bg-neutral-100 text-neutral-700 border-neutral-200"}`}
        >
          {room.status || "—"}
        </span>
      </Link>
    </li>
  );
}
