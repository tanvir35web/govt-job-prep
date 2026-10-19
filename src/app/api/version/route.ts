import { connection } from "next/server";
import { success } from "@/lib/api-response";

// GET /api/version
// The build currently deployed. An installed app compares this with the build it is running.
export async function GET() {
  await connection();

  const res = success("Current build.", {
    version: process.env.APP_VERSION,
    build_id: process.env.APP_BUILD_ID,
    build_time: process.env.APP_BUILD_TIME,
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
