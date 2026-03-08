"use client";

import dynamic from "next/dynamic";

const TextMotionEditor = dynamic(
  () => import("@/components/text-motion/TextMotionEditor").then((module) => module.TextMotionEditor),
  {
    ssr: false,
  },
);

export const TextMotionShell = () => {
  return <TextMotionEditor />;
};
