import type { Metadata } from "next";
import { Suspense } from "react";
import { GalleryView } from "@/components/gallery-view";

export const metadata: Metadata = { title: "公示" };

export default function GalleryPage() {
  return (
    <Suspense fallback={<div className="page"><div className="skeleton" style={{ height: 240 }} /></div>}>
      <GalleryView />
    </Suspense>
  );
}
