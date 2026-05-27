import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { clockIn, getRooms } from "@/lib/sheets.functions";

export const Route = createFileRoute("/clean/$row")({
  head: () => ({
    meta: [{ title: "Rozpocznij sprzątanie — Apartamenty Pilice" }],
  }),
  component: CleanPage,
});

function CleanPage() {
  const { row } = Route.useParams();
  const rowNum = Number(row);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchRooms = useServerFn(getRooms);
  const clockInFn = useServerFn(clockIn);

  const { data, isLoading } = useQuery({
    queryKey: ["rooms"],
    queryFn: () => fetchRooms(),
  });
  const room = data?.rooms.find((r) => r.row === rowNum);

  const [name, setName] = useState("");
  const mut = useMutation({
    mutationFn: (cleanerName: string) =>
      clockInFn({ data: { row: rowNum, cleanerName } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rooms"] });
      navigate({ to: "/" });
    },
  });

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <h1 className="text-base font-semibold text-neutral-900">Rozpocznij sprzątanie</h1>
          <Link
            to="/"
            className="rounded-md border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
          >
            ← Anuluj
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-6">
        {isLoading && <p className="text-sm text-neutral-500">Ładowanie…</p>}
        {!isLoading && !room && (
          <p className="text-sm text-red-600">Nie znaleziono pokoju.</p>
        )}
        {room && (
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex items-baseline gap-2">
              {room.roomId && (
                <span className="text-2xl font-bold text-neutral-900">
                  #{room.roomId}
                </span>
              )}
              <span className="text-lg text-neutral-700">{room.roomName}</span>
            </div>
            {room.notes && (
              <p className="mt-3 whitespace-pre-wrap rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                📝 {room.notes}
              </p>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (name.trim()) mut.mutate(name.trim());
              }}
              className="mt-5 space-y-3"
            >
              <label className="block text-sm font-medium text-neutral-700">
                Twoje imię
              </label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="np. Anna"
                maxLength={80}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-base focus:border-neutral-900 focus:outline-none"
              />
              <button
                type="submit"
                disabled={mut.isPending || !name.trim()}
                className="w-full rounded-md bg-emerald-600 px-4 py-3 text-base font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {mut.isPending ? "Rozpoczynanie…" : "Rozpocznij sprzątanie"}
              </button>
              {mut.error && (
                <p className="text-xs text-red-600">{(mut.error as Error).message}</p>
              )}
            </form>
          </div>
        )}
      </main>
    </div>
  );
}