"use client";

import type { MockQuestion } from "./types";

export type BankQuestion = MockQuestion;

export function bankKey(slug: string, questionNo: number) {
  return `${slug}#${questionNo}`;
}
