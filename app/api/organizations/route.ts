import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface OrganizationRow {
  organization_id: string;
  name: string | null;
}

function getDatabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Organization lookup service is not configured");
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET() {
  try {
    const { data, error } = await getDatabaseClient()
      .from("organizations")
      .select("organization_id, name")
      .order("name", { ascending: true });

    if (error) {
      throw error;
    }

    const organizations = ((data ?? []) as OrganizationRow[])
      .filter((organization) => Boolean(organization.organization_id))
      .map((organization) => ({
        id: organization.organization_id,
        name: organization.name?.trim() || organization.organization_id,
      }));

    return NextResponse.json(
      { organizations },
      { headers: { "Cache-Control": "private, max-age=300" } }
    );
  } catch (error) {
    console.error("Unable to load organizations", error);
    return NextResponse.json(
      { error: "Unable to load organizations." },
      { status: 500 }
    );
  }
}
