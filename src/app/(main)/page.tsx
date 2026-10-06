import type { Metadata } from "next";
import { HomeView } from "@/components/home-view";
import type { HomeStats } from "@/lib/types";
import { ensureSeed, getHomeStats } from "@/server/data";

export const metadata: Metadata = { title: "首页" };
export const dynamic = "force-dynamic";

const empty: HomeStats = {
  submissions: 0,
  models: 0,
  thirdParty: 0,
  official: 0,
  references: 0,
  avgDurationMs: null,
  avgOutputTokens: null,
  views24h: 0,
  viewsTotal: 0,
  unique24h: 0,
  recent: [],
  referencesItems: [],
  dbReady: false,
};

export default async function HomePage() {
  let stats = empty;
  try {
    await ensureSeed();
    stats = await getHomeStats();
  } catch {
    stats = empty;
  }
  return <HomeView stats={stats} />;
}
