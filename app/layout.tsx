import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "砺石情景研究终端",
  description:
    "使用免费公开行情、历史价格与中国宏观数据的只读投研平台，主观情景与真实数据分开展示。",
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
