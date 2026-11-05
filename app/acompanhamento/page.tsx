import type { Metadata } from "next";
import TrackingView from "./tracking-view";
export const metadata: Metadata = {
  title: "Acompanhar atendimento | VALLEX", robots: { index: false, follow: false }, referrer: "no-referrer",
};
export default function TrackingPage() { return <TrackingView />; }
