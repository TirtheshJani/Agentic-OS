import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";

export async function GET() {
  // Read-only. Settings are edited directly in the JSON file for now;
  // a write endpoint and UI ship in Phase 6.
  return NextResponse.json(getSettings());
}
