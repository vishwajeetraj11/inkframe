"use client";

import Clarity from "@microsoft/clarity";
import { useEffect } from "react";

export const ClarityInit = ({ projectId }: { projectId: string }) => {
  useEffect(() => {
    Clarity.init(projectId);
  }, [projectId]);

  return null;
};
