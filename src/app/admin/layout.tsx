import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Innerly admin",
  // Nothing links here from the app, and nothing should index it either.
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
