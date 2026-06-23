"use client";

import { Suspense } from "react";
import DashboardContent from "./dashboard-content";

export default function DashboardPage() {
    return (
        <Suspense fallback={<DashboardLoader />}>
            <DashboardContent />
        </Suspense>
    );
}

function DashboardLoader() {
    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-600" />
        </div>
    );
}
