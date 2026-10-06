import type { Metadata } from "next";
import { Bench } from "@/components/bench";

export const metadata: Metadata = { title: "测试" };

export default function TestPage() {
  return <Bench />;
}
