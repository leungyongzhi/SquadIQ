"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useViewMode } from "@/app/(app)/layout";
import type { MatchEvent } from "@/lib/football/types";
import { Plus, Calendar, MarkerPin01, Clock, ChevronRight, Edit01, Link01 } from "@untitledui/icons";
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

function EventFormModal({ event, communities, lockedCommunityId, onSave, onClose }: {
    event?: MatchEvent;
    communities: { id: string; name: string; default_payment_link?: string | null; default_payment_amount?: number | null; default_payment_message?: string | null; community_details?: Record<string, any> | null }[];
    lockedCommunityId?: string; // set for community admins — auto-selected, no dropdown
    onSave: (data: Partial<MatchEvent>) => Promise<void>;
    onClose: () => void;
}) {
    const initialCommunityId = event?.community_id ?? lockedCommunityId ?? "";
    const initialCommunity = communities.find((c) => c.id === initialCommunityId);
    const getDefaultLocation = (comm: typeof communities[0] | undefined) => comm?.community_details?.location_name ?? "";
    const getDefaultMapsLink = (comm: typeof communities[0] | undefined) => comm?.community_details?.location_maps_url ?? "";
    const [form, setForm] = useState({
        title: event?.title ?? "",
        community_id: initialCommunityId,
        event_date: event?.event_date ?? new Date().toISOString().split("T")[0],
        event_time: event?.event_time?.slice(0, 5) ?? "19:00",
        location: event?.location ?? getDefaultLocation(initialCommunity),
        maps_link: event?.maps_link ?? getDefaultMapsLink(initialCommunity),
        payment_link: event?.payment_link ?? initialCommunity?.default_payment_link ?? "",
        payment_message: event?.payment_message ?? initialCommunity?.default_payment_message ?? "",
    });
    const [saving, setSaving] = useState(false);

    const handleCommunityChange = (communityId: string) => {
        const comm = communities.find((c) => c.id === communityId);
        const defaultLocation = getDefaultLocation(comm);
        const defaultMapsLink = getDefaultMapsLink(comm);
        const defaultPaymentLink = comm?.default_payment_link || "";
        const defaultPaymentMessage = comm?.default_payment_message || "";
        setForm((f) => ({
            ...f,
            community_id: communityId,
            location: f.location?.trim() ? f.location : defaultLocation,
            maps_link: f.maps_link?.trim() ? f.maps_link : defaultMapsLink,
            payment_link: f.payment_link?.trim() ? f.payment_link : defaultPaymentLink,
            payment_message: f.payment_message?.trim() ? f.payment_message : defaultPaymentMessage,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        await onSave({ ...form, community_id: form.community_id || null });
        setSaving(false);
    };

    const inputCls = "w-full px-3.5 py-2.5 rounded-lg border border-primary bg-primary text-primary text-sm placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-brand transition duration-100 ease-linear";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-overlay" onClick={onClose} />
            <div className="relative bg-primary rounded-2xl border border-secondary shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <h2 className="text-lg font-semibold text-primary mb-5">{event ? "Edit Match Day" : "New Match Day"}</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {lockedCommunityId ? (
                            <div>
                                <label className="block text-sm font-medium text-secondary mb-1.5">Community</label>
                                <p className="px-3.5 py-2.5 rounded-lg border border-primary bg-secondary text-sm text-secondary">
                                    {communities.find((c) => c.id === lockedCommunityId)?.name ?? "Your community"}
                                </p>
                            </div>
                        ) : (
                            <div>
                                <label className="block text-sm font-medium text-secondary mb-1.5">Community</label>
                                <select
                                    value={form.community_id}
                                    onChange={(e) => handleCommunityChange(e.target.value)}
                                    className={inputCls}
                                    required
                                >
                                    <option value="">Select a community…</option>
                                    {communities.map((c) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium text-secondary mb-1.5">Title</label>
                            <input type="text" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Wednesday Kickabout" className={inputCls} required />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-secondary mb-1.5">Date</label>
                                <input type="date" value={form.event_date} onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))} className={inputCls} required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-secondary mb-1.5">Time</label>
                                <input type="time" value={form.event_time} onChange={(e) => setForm((f) => ({ ...f, event_time: e.target.value }))} className={inputCls} required />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-secondary mb-1.5">Location</label>
                            <input type="text" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="e.g. Hackney Marshes" className={inputCls} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-secondary mb-1.5">Google Maps Link</label>
                            <input type="url" value={form.maps_link} onChange={(e) => setForm((f) => ({ ...f, maps_link: e.target.value }))} placeholder="https://maps.google.com/..." className={inputCls} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-secondary mb-1.5">Payment Link</label>
                            <input type="url" value={form.payment_link} onChange={(e) => setForm((f) => ({ ...f, payment_link: e.target.value }))} placeholder="https://monzo.me/..." className={inputCls} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-secondary mb-1.5">Payment Reminder Message</label>
                            <textarea value={form.payment_message} onChange={(e) => setForm((f) => ({ ...f, payment_message: e.target.value }))} placeholder="e.g. Please pay £5 via the link below before the match." rows={2} className={cx(inputCls, "resize-none")} />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={onClose} className="flex-1 py-2.5 px-4 border border-primary text-sm font-semibold text-secondary rounded-lg hover:bg-primary_hover transition duration-100 ease-linear">Cancel</button>
                            <button type="submit" disabled={saving} className="flex-1 py-2.5 px-4 bg-brand-solid hover:bg-brand-solid_hover text-white text-sm font-semibold rounded-lg transition duration-100 ease-linear disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default function EventsPage() {
    const { isAdmin, isSuperAdmin, adminCommunityIds } = useViewMode();
    const [events, setEvents] = useState<MatchEvent[]>([]);
    const [communities, setCommunities] = useState<{ id: string; name: string; default_payment_link?: string | null; default_payment_amount?: number | null; default_payment_message?: string | null; community_details?: Record<string, any> | null }[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingEvent, setEditingEvent] = useState<MatchEvent | undefined>(undefined);
    const [showForm, setShowForm] = useState(false);
    const [filter, setFilter] = useState<"all" | "scheduled" | "completed">("all");
    const supabase = createClient();

    const loadEvents = async () => {
        const [{ data: evData }, { data: comData }] = await Promise.all([
            supabase.from("match_events").select("*").order("event_date", { ascending: false }),
            supabase.from("communities").select("id, name, default_payment_link, default_payment_amount, default_payment_message, community_details").order("name"),
        ]);
        setEvents(evData ?? []);
        setCommunities(comData ?? []);
        setLoading(false);
    };

    useEffect(() => {
        loadEvents();
    }, []);

    const handleSave = async (data: Partial<MatchEvent>) => {
        try {
            if (editingEvent) {
                const { error } = await supabase.from("match_events").update(data).eq("id", editingEvent.id);
                if (error) throw error;
            } else {
                // Only include maps_link if it has a value (column may not exist in older schemas)
                const payload: any = {
                    ...data,
                    status: "scheduled" as const,
                };
                if (!data.maps_link) delete payload.maps_link;
                const { error } = await supabase.from("match_events").insert(payload);
                if (error) throw error;
            }
            await loadEvents();
            setShowForm(false);
            setEditingEvent(undefined);
        } catch (error: any) {
            console.error("Save failed:", error.message);
            alert(`Failed to save event: ${error.message}`);
        }
    };

    const openEdit = (event: MatchEvent, e: React.MouseEvent) => {
        e.preventDefault();
        setEditingEvent(event);
        setShowForm(true);
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
                        <div key={event.id} className="relative flex flex-col gap-3 bg-primary rounded-xl border border-secondary p-4 hover:border-brand hover:shadow-sm transition duration-100 ease-linear md:flex-row md:items-center md:gap-4">
                            <Link href={`/events/${event.id}`} className="absolute inset-0 rounded-xl" />
                            <div className="flex size-12 items-center justify-center rounded-xl bg-brand-secondary flex-shrink-0">
                                <Calendar className="size-5 text-brand-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                    <p className="text-sm font-semibold text-primary">{event.title}</p>
                                    {statusBadge(event.status)}
                                    {!event.community_id && isAdmin && (
                                        <span className="text-xs text-warning-primary bg-warning-primary px-1.5 py-0.5 rounded">No community</span>
                                    )}
                                </div>
                                <div className="flex flex-col gap-1 text-xs text-tertiary md:flex-row md:items-center md:gap-3">
                                    <span className="flex items-center gap-1">
                                        <Clock className="size-3.5" />
                                        {new Date(event.event_date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} · {event.event_time?.slice(0, 5)}
                                    </span>
                                    {event.location && (
                                        <span className="flex items-center gap-1">
                                            <MarkerPin01 className="size-3.5" />
                                            {event.location}
                                        </span>
                                    )}
                                </div>
                                {event.maps_link && (
                                    <a
                                        href={event.maps_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="relative z-10 inline-flex items-center gap-1 text-xs text-brand-secondary hover:text-brand-primary transition duration-100 ease-linear mt-1"
                                    >
                                        <Link01 className="size-3" /> Maps
                                    </a>
                                )}
                                {event.status === "completed" && (
                                    <p className="text-xs font-semibold text-primary mt-1">
                                        🔵 {event.score_blue} – {event.score_orange} 🟠
                                    </p>
                                )}
                            </div>
                            {isAdmin && (
                                <button
                                    onClick={(e) => openEdit(event, e)}
                                    className="relative z-10 p-2 rounded-lg text-quaternary hover:text-secondary hover:bg-primary_hover transition duration-100 ease-linear flex-shrink-0"
                                >
                                    <Edit01 className="size-4" />
                                </button>
                            )}
                            <ChevronRight className="size-5 text-quaternary flex-shrink-0 relative z-0" />
                        </div>
                    ))}
                </div>
            )}

            {showForm && (
                <EventFormModal
                    event={editingEvent}
                    communities={communities}
                    lockedCommunityId={!isSuperAdmin && adminCommunityIds.length === 1 ? adminCommunityIds[0] : undefined}
                    onSave={handleSave}
                    onClose={() => { setShowForm(false); setEditingEvent(undefined); }}
                />
            )}
        </div>
    );
}
