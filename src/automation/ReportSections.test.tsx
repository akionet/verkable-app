import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Errors } from "./Errors";
import { JudgeStops } from "./JudgeStops";
import { Published } from "./Published";
import { PendingQueue } from "./PendingQueue";

it("@OBS-001-F1-01 renders empty states for a valid quiet report", () => {
  render(<><Published items={[]} /><JudgeStops judge={{ approve: 0, revise: 0, stop: 0, with_polish: 0, stops: [] }} /><Errors items={[]} /></>);
  expect(screen.getByText("No recipes published in this report window.")).toBeInTheDocument();
  expect(screen.getByText("No judge stops in this report window.")).toBeInTheDocument();
  expect(screen.getByText("No errors recorded in this report window.")).toBeInTheDocument();
});

it("@OBS-001-F1-01 renders error text without interpreting markup", () => {
  render(<Errors items={[{ at: "2026-11-15T00:00:00Z", text: "<img src=x onerror=alert(1)>" }]} />);
  expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});

it("@OBS-001-F1-02 distinguishes a successful empty queue", () => {
  render(<PendingQueue items={[]} asOf="2026-11-15T00:00:00Z" />);
  expect(screen.getByText("No gates waiting on a human.")).toBeInTheDocument();
});
