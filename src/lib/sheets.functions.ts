import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SPREADSHEET_ID = "1hne3vp8EQtLIqdGgGDKFm2I9nr2PlICHBy0dgj4lZsE";
const SHEET_NAME = "Rooms";
const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

// Status values that exist in the sheet's Selection tab + one transient state we add
export const STATUSES = [
  "Gotowe",
  "Wolne / do sprzątnięcia",
  "Priorytet / do sprzątnięcia",
  "Zajęte",
  "Sprzątanie w toku",
] as const;
export type RoomStatus = (typeof STATUSES)[number];

export type Room = {
  row: number; // 1-based sheet row, >= 2
  roomId: string;
  roomName: string;
  floor: string;
  status: string;
  timeStamp: string;
  cleanerName: string;
  startTime: string;
  endTime: string;
  totalTime: string;
  notes: string;
};

function gatewayHeaders() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const sheetsKey = process.env.GOOGLE_SHEETS_API_KEY;
  if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");
  if (!sheetsKey) throw new Error("GOOGLE_SHEETS_API_KEY is not configured");
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": sheetsKey,
    "Content-Type": "application/json",
  };
}

function nowWarsaw(): { stamp: string; date: Date } {
  const date = new Date();
  // Format YYYY-MM-DD HH:MM in Europe/Warsaw
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const stamp = `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
  return { stamp, date };
}

function diffHHMM(startStamp: string, endStamp: string): string {
  // stamps look like "YYYY-MM-DD HH:MM" interpreted as Europe/Warsaw local
  const toDate = (s: string) => {
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
    if (!m) return null;
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
  };
  const a = toDate(startStamp);
  const b = toDate(endStamp);
  if (!a || !b) return "";
  const mins = Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

async function readRows(): Promise<Room[]> {
  const range = `${SHEET_NAME}!A2:J100`;
  const res = await fetch(`${GATEWAY}/spreadsheets/${SPREADSHEET_ID}/values/${range}`, {
    headers: gatewayHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Sheets read failed [${res.status}]: ${await res.text()}`);
  }
  const data = (await res.json()) as { values?: string[][] };
  const rows = data.values ?? [];
  return rows
    .map((r, i) => {
      const cells = [...r];
      while (cells.length < 10) cells.push("");
      return {
        row: i + 2,
        roomId: cells[0],
        roomName: cells[1],
        floor: cells[2],
        status: cells[3],
        timeStamp: cells[4],
        cleanerName: cells[5],
        startTime: cells[6],
        endTime: cells[7],
        totalTime: cells[8],
        notes: cells[9],
      } satisfies Room;
    })
    .filter((r) => r.roomName.trim() !== "");
}

async function writeRange(range: string, values: (string | number)[][]) {
  const url = `${GATEWAY}/spreadsheets/${SPREADSHEET_ID}/values/${range}?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: "PUT",
    headers: gatewayHeaders(),
    body: JSON.stringify({ range, majorDimension: "ROWS", values }),
  });
  if (!res.ok) {
    throw new Error(`Sheets write failed [${res.status}]: ${await res.text()}`);
  }
}

export const getRooms = createServerFn({ method: "GET" }).handler(async () => {
  const rooms = await readRows();
  return { rooms };
});

export const clockIn = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        row: z.number().int().min(2).max(200),
        cleanerName: z.string().trim().min(1).max(80),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { stamp } = nowWarsaw();
    // Write D:I = [status, timestamp, cleaner, start, end(empty), total(empty)]
    await writeRange(`${SHEET_NAME}!D${data.row}:I${data.row}`, [
      ["Sprzątanie w toku", stamp, data.cleanerName, stamp, "", ""],
    ]);
    return { ok: true };
  });

export const clockOut = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ row: z.number().int().min(2).max(200) }).parse(data),
  )
  .handler(async ({ data }) => {
    // Need start time to compute total
    const rooms = await readRows();
    const room = rooms.find((r) => r.row === data.row);
    if (!room) throw new Error("Room not found");
    const { stamp } = nowWarsaw();
    const total = room.startTime ? diffHHMM(room.startTime, stamp) : "";
    // Update D (status), E (timestamp), H (end), I (total)
    await writeRange(`${SHEET_NAME}!D${data.row}:I${data.row}`, [
      ["Gotowe", stamp, room.cleanerName, room.startTime, stamp, total],
    ]);
    return { ok: true };
  });

export const setRoomStatus = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        row: z.number().int().min(2).max(200),
        status: z.enum(STATUSES),
        pin: z.string().min(1).max(32),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const expected = process.env.OWNER_PIN;
    if (!expected) throw new Error("OWNER_PIN not configured");
    if (data.pin !== expected) throw new Error("Invalid PIN");
    const { stamp } = nowWarsaw();
    // Update only D (status) and E (timestamp)
    await writeRange(`${SHEET_NAME}!D${data.row}:E${data.row}`, [
      [data.status, stamp],
    ]);
    return { ok: true };
  });

export const verifyOwnerPin = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ pin: z.string().min(1).max(32) }).parse(data))
  .handler(async ({ data }) => {
    const expected = process.env.OWNER_PIN;
    if (!expected) throw new Error("OWNER_PIN not configured");
    return { ok: data.pin === expected };
  });

export const setRoomNotes = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        row: z.number().int().min(2).max(200),
        notes: z.string().max(2000),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    // Column J = Notes
    await writeRange(`${SHEET_NAME}!J${data.row}`, [[data.notes]]);
    return { ok: true };
  });