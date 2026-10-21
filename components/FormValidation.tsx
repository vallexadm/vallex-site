"use client";

import { useEffect } from "react";
import { installFormValidation } from "@/lib/form-validation";

export default function FormValidation() {
  useEffect(() => installFormValidation(document), []);
  return null;
}
