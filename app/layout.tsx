import type React from "react"
import { Geist } from "next/font/google"
import "./globals.css"

const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geist.variable} antialiased`}>
      <body className="font-sans" suppressHydrationWarning={true}>
        {children}
      </body>
    </html>
  )
}
