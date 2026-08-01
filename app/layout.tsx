import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "砺石情景研究终端",
  description:
    "面向基金研究实习生的地缘事件推演、A股筛选、组合回测与投研学习平台。",
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
