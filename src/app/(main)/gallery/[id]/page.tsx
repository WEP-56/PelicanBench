import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DetailView } from "@/components/detail-view";
import { getResult, toPublic } from "@/server/data";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const row = await getResult(id).catch(() => null);
  return { title: row && row.status === "published" ? row.model : "公示" };
}

export default async function GalleryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await getResult(id).catch(() => null);
  if (!row || row.status !== "published") notFound();
  return <DetailView item={toPublic(row)} />;
}
