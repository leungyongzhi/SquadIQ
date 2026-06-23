import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "@/styles/globals.css";

const dmSans = DM_Sans({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-dm-sans",
    weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
    title: "Football Manager",
    description: "Team generation and match management for your football group.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body className={`${dmSans.variable} font-sans antialiased`}>
                {children}
            </body>
        </html>
    );
}
