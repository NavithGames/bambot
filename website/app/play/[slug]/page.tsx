"use client";
import { useParams } from "next/navigation";
import { notFound } from "next/navigation";
import dynamic from "next/dynamic";
import { robotConfigMap } from "@/config/robotConfig";

const RobotLoader = dynamic(
  () => import("@/components/playground/RobotLoader"),
  { ssr: false, loading: () => <div className="flex items-center justify-center w-screen h-screen text-white text-2xl">Loading...</div> }
);

export default function Page() {
  const params = useParams();
  const slug = params?.slug as string;

  if (!robotConfigMap[slug]) {
    notFound();
  }

  return (
    <div className="relative w-screen h-dvh">
      <RobotLoader robotName={slug} />
    </div>
  );
}
