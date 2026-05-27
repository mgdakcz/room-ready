import { createFileRoute } from "@tanstack/react-router";

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

function Index() {
  return (
    <div
      className="flex min-h-screen items-center justify-center px-6"
      style={{ backgroundColor: "#fcfbf8" }}
    >
      <div className="text-center">
        <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight text-neutral-900">
          Hello, Apartamenty Pilice Tracker
        </h1>
        <p className="mt-4 text-neutral-600 text-base sm:text-lg">
          Cleaning progress, room by room.
        </p>
      </div>
    </div>
  );
}
