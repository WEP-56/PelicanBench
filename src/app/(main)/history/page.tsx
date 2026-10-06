import type { Metadata } from "next";
import { HistoryView } from "@/components/history-view";

export const metadata: Metadata = { title: "历史" };

export default function HistoryPage() {
  return <HistoryView />;
}
