"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { MatchEvent } from "@/lib/football/types";
import { Plus, Calendar, MarkerPin01, Clock, ChevronRight } from "@untitledui/icons";
import { cx } from "@/utils/cx";

function statusBadge(status: string) {
    const map: Record<string, { label: string; cls: string }> = {
        scheduled: { label: "Scheduled", cls: "bg-brand-secondary text-brand-primary" },
        in_progress: { label: "In Progress", cls: "bg-warning-primary text-warning-primary" },
        completed: { label: "Completed", cls: "bg-success-primary text-success-primary" },
    };
    const s = map[status] ?? map.scheduled;
    return (
        <span className={cx("text-xs font-medium px-2 py-0.5 rounded-full", s.cls)}>
            {s.label}
        </span>
    );
}

function EventFormModal({ event, onSave, onClose }: {
    event?: MatchEvent;
    onSave: (data: Partial<MatchEvent>) => Promise<void>;
    onClose: () => void;
}) {
    const [form, setForm] = useState({
        title: event?.title ?? "",
        event_date: event?.event_date ?? new Date().toISOString().split("T")[0],
        event_time: event?.event_time?.slice(0, 5) ?? "19:00",
        location: event?.location ?? "",
        payment_link: event?.payment_link ?? "",
        payment_message: event?.payment_message ?? "",
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        await onSave(form);
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-overlay" onClick={onClose} />
            <div className="relative bg-primary rounded-2xl border border-secondary shadow-xl w-full max-w-md">
                <div className="p-6">
                    <h2 className="text-lg font-semibold text-primary mb-5">{event ? "Edit Event" : "New Match Day"}</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-secondary mb-1.5">Title</label>
                            <input
                                type="text"
                                value={form.title}
                                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                                placeholder="e.g. Wednesday Kickabout"
                                className="w-full px-3.5 py-2.5 rounded-lg border border-primary bg-primary text-primary text-sm placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-brand transition duration-100 ease-linear"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-secondary mb-1.5">Date</label>
                                <input
                                    type="date"
                                    value={form.event_date}
                                    onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))}
                                    className="w-full px-3.5 py-2.5 rounded-lg border border-primary bg-primary text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand transition duration-100 ease-linear"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-secondary mb-1.5">Time</label>
                                <input
                                    type="time"
                                    value={form.event_time}
                                    onChange={(e) => setForm((f) => ({ ...f, event_time: e.target.value }))}
                                    className="w-full px-3.5 py-2.5 rounded-lg border border-primary bg-primary text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand transition duration-100 ease-linear"
                                    required
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-secondary mb-1.5">Location</label>
                            <input
                                type="text"
                                value={form.location}
                                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                                placeholder="e.g. Hackney Marshes"
                                className="w-full px-3.5 py-2.5 rounded-lg border border-primary bg-primary text-primary text-sm placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-brand transition duration-100 ease-linear"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-secondary mb-1.5">Payment Link</label>
                            <input
                                type="url"
                                value={form.payment_link}
                                onChange={(e) => setForm((f) => ({ ...f, payment_link: e.target.value }))}
                                placeholder="https://monzo.me/..."
                                className="w-full px-3.5 py-2.5 rounded-lg border border-primary bg-primary text-primary text-sm placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-brand transition duration-100 ease-linear"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-secondary mb-1.5">Payment Reminder Message</label>
                            <textarea
                                value={form.payment_message}
                                onChange={(e) => setForm((f) => ({ ...f, payment_message: e.target.value }))}
                                placeholder="e.g. Please pay £5 via the link below before the match."
                                rows={2}
                                className="w-full px-3.5 py-2.5 rounded-lg border border-primary bg-primary text-primary text-sm placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-brand transition duration-100 ease-linear resize-none"
                            />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={onClose} className="flex-1 py-2.5 px-4 border border-primary text-sm font-semibold text-secondary rounded-lg hover:bg-primary_hover transition duration-100 ease-linear">
                                Cancel
                            </button>
                            <button type="submit" disabled={saving} className="flex-1 py-2.5 px-4 bg-brand-solid hover:bg-brand-solid_hover text-white text-sm font-semibold rounded-lg transition duration-100 ease-linear disabled:opacity-50">
                                {saving ? "Saving..." : "Save"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default function EventsPage() {
    const [events, setEvents] = useState<MatchEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [filter, setFilter] = useState<"all" | "scheduled" | "completed">("all");
    const supabase = createClient();

    const loadEvents = async () => {
        const { data } = await supabase
            .from("match_events")
            .select("*")
            .order("event_date", { ascending: false });
        setEvents(data ?? []);
        setLoading(false);
    };

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (!user) return;
            supabase.from("user_profiles").select("role").eq("id", user.id).single().then(({ data }) => {
                setIsAdmin(data?.role === "admin");
            });
        });
        loadEvents();
    }, []);

    const handleSave = async (data: Partial<MatchEvent>) => {
        await supabase.from("match_events").insert(data);
        await loadEvents();
        setShowForm(false);
    };

    const filtered = events.filter((e) => filter === "all" || e.status === filter);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-primary">Match Days</h1>
                    <p className="text-sm text-tertiary mt-1">{events.length} total events</p>
                </div>
                {isAdmin && (
                    <button
                        onClick={() => setShowForm(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-brand-solid hover:bg-brand-solid_hover text-white text-sm font-semibold rounded-lg transition duration-100 ease-linear"
                    >
                        <Plus className="size-4" />
                        New Event
                    </button>
                )}
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1 bg-secondary rounded-lg p-1 w-fit">
                {(["all", "scheduled", "completed"] as const).map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={cx(
                            "px-3 py-1.5 rounded-md text-sm font-medium transition duration-100 ease-linear capitalize",
                            filter === f ? "bg-primary text-primary shadow-sm" : "text-tertiary hover:text-secondary",
                        )}
                    >
                        {f}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-48">
                    <div className="size-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16 text-tertiary">
                    <Calendar className="size-10 mx-auto mb-3 text-quaternary" />
                    <p className="text-sm">No events found</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map((event) => (
                        <Link
                            key={event.id}
                            href={`/football/events/${event.id}`}
                            className="flex items-center gap-4 bg-primary rounded-xl border border-secondary p-4 hover:border-brand hover:shadow-sm transition duration-100 ease-linear"
                        >
                            <div className="flex size-12 items-center justify-center rounded-xl bg-brand-secondary flex-shrink-0">
                                <Calendar className="size-5 text-brand-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <p className="text-sm font-semibold text-primary truncate">{event.title}</p>
                                    {statusBadge(event.status)}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-tertiary">
                                    <span className="flex items-center gap-1">
                                        <Clock className="size-3.5" />
                                        {new Date(event.event_date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })} · {event.event_time?.slice(0, 5)}
                                    </span>
                                    {event.location && (
                                        <span className="flex items-center gap-1">
                                            <MarkerPin01 className="size-3.5" />
                                            {event.location}
                                        </span>
                                    )}
                                </div>
                                {event.status === "completed" && (
                                    <p className="text-xs font-semibold text-primary mt-1">
                                        🔵 {event.score_blue} – {event.score_orange} 🟠
                                    </p>
                                )}
                            </div>
                            <ChevronRight className="size-5 text-quaternary flex-shrink-0" />
                        </Link>
                    ))}
                </div>
            )}

            {showForm && (
                <EventFormModal onSave={handleSave} onClose={() => setShowForm(false)} />
            )}
        </div>
    );
}
