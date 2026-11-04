import type { Metadata } from "next";
import CustomerAccess from "./customer-access";

export const metadata: Metadata = {
  title: "Área do cliente | VALLEX ServiçoFácil",
  robots: { index: false, follow: false },
};

export default function CustomerPage() {
  return <CustomerAccess />;
}
