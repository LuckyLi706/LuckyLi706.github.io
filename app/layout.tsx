import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "砺石情景研究终端",
  description:
    "融合中国宏观、黑天鹅事件、A股筛选、组合回测与冠军挑战者自主学习机制的投研平台。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
