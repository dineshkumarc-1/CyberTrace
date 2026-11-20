import "./globals.css";
export const metadata = {
  title: "CyberTrace | Incident intelligence",
  description:
    "Cybersecurity incident management and semantic knowledge retrieval",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
