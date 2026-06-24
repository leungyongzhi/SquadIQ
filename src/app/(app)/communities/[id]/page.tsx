"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useViewMode } from "@/app/(app)/layout";
import type { Community, CommunityMember, MatchEvent } from "@/lib/football/types";
import { POSITION_LABELS } from "@/lib/football/types";
import {
    ArrowLeft, Users01, Plus, Edit01, Check, Shield01, Star01, Trash01,
    Calendar, Clock, MarkerPin01, CheckCircle, XCircle, BarChart01, Trophy01, Settings01, Link01, Bank,
    LayersThree01, LinkExternal01, ChevronDown,
} from "@untitledui/icons";
import { cx } from "@/utils/cx";

const RATING_LABELS = ["Beginner", "Casual", "Intermediate", "Talented", "Advanced", "Pro"];

function RatingSlider({ value, label, onChange }: { value: number; label: string; onChange: (v: number) => void }) {
    const pct = ((value - 1) / 5) * 100;
    // Thumb is ~16px wide; adjust so bubble stays on-track at extremes
    const bubbleLeft = `calc(${pct}% + ${(8 - pct * 0.16).toFixed(1)}px)`;
    return (
        <div>
            <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-secondary">{label}</label>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-solid text-white transition-all duration-100">
                    {RATING_LABELS[value - 1]}
                </span>
            </div>
            <div className="relative pt-6 pb-1">
                <div
                    className="absolute top-0 -translate-x-1/2 bg-brand-solid text-white text-xs font-semibold px-2 py-0.5 rounded-full pointer-events-none whitespace-nowrap shadow-sm"
                    style={{ left: bubbleLeft }}
                >
                    {RATING_LABELS[value - 1]}
                </div>
                <input
                    type="range" min={1} max={6} value={value}
                    onChange={(e) => onChange(+e.target.value)}
                    className="w-full accent-brand-600"
                />
            </div>
            <div className="flex justify-between text-xs text-quaternary mt-1 px-0.5">
                {[1, 2, 3, 4, 5, 6].map((n) => <span key={n}>{n}</span>)}
            </div>
            <div className="flex justify-between text-xs text-quaternary mt-0.5 px-0.5">
                <span>Beginner</span><span className="pr-1">Pro</span>
            </div>
        </div>
    );
}

const SPORT_TYPES = [
    "Football", "Futsal", "Basketball", "Netball", "Volleyball", "Handball",
    "Rugby Union", "Rugby League", "Gaelic Football", "Australian Rules Football",
    "Field Hockey", "Ice Hockey", "Cricket", "Baseball", "Softball",
    "American Football", "Lacrosse", "Water Polo", "Hurling", "Kabaddi",
];

const TURF_TYPES = [
    { value: "natural_grass", label: "Natural Grass" },
    { value: "3g", label: "3G Artificial (rubber crumb)" },
    { value: "4g", label: "4G Artificial" },
    { value: "astroturf", label: "Astroturf (sand-dressed)" },
    { value: "futsal", label: "Futsal Court" },
    { value: "indoor", label: "Indoor (Sports Hall)" },
    { value: "cage_muga", label: "Cage / MUGA" },
    { value: "hard_court", label: "Hard Court" },
];

const DAYS = [
    { value: "monday", label: "Mon" },
    { value: "tuesday", label: "Tue" },
    { value: "wednesday", label: "Wed" },
    { value: "thursday", label: "Thu" },
    { value: "friday", label: "Fri" },
    { value: "saturday", label: "Sat" },
    { value: "sunday", label: "Sun" },
];

const DURATION_OPTIONS = [
    { value: "30min", label: "30 minutes" },
    { value: "45min", label: "45 minutes" },
    { value: "1h", label: "1 hour" },
    { value: "1h15", label: "1 hour 15 min" },
    { value: "1h30", label: "1 hour 30 min" },
    { value: "1h45", label: "1 hour 45 min" },
    { value: "2h", label: "2 hours" },
    { value: "2h30", label: "2 hours 30 min" },
];

function calcDuration(start: string, end: string): string {
    if (!start || !end) return "";
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff <= 0) return "";
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    if (h === 0) return `${m}min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}min`;
}

function formatTime(t: string): string {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "pm" : "am";
    return `${h % 12 || 12}:${m.toString().padStart(2, "0")}${ampm}`;
}

type MemberWithPlayer = CommunityMember & {
    player: { id: string; name: string; avatar_url: string | null };
};
type AllPlayer = { id: string; name: string; avatar_url: string | null };
type Tab = "members" | "matchdays" | "stats" | "settings";
interface EventWithEnrollment extends MatchEvent { isEnrolled: boolean; enrollmentId: string | null; }
interface CommunityStats { gp: number; goals: number; assists: number; potm: number; }

function CommunityDetailsCard({ details }: { details: Record<string, any> }) {
    const rows: { icon: React.FC<any>; label: string; content: React.ReactNode }[] = [];

    if (details.gender) {
        const label = details.gender === "male" ? "Male" : details.gender === "female" ? "Female" : "Mixed Gender";
        rows.push({ icon: Users01, label: "Players", content: label });
    }
    if (details.turf) {
        const turf = TURF_TYPES.find((t) => t.value === details.turf);
        rows.push({ icon: LayersThree01, label: "Turf", content: turf?.label ?? details.turf });
    }
    if (details.days?.length > 0) {
        const dayLabels = DAYS.filter((d) => details.days.includes(d.value)).map((d) => d.label);
        rows.push({ icon: Calendar, label: "Day", content: dayLabels.join(", ") });
    }
    if (details.start_time) {
        const start = formatTime(details.start_time);
        let timeContent: React.ReactNode;
        if (details.end_time) {
            const end = formatTime(details.end_time);
            const dur = calcDuration(details.start_time, details.end_time);
            timeContent = <>{start} – {end}{dur && <span className="ml-2 text-xs text-tertiary">({dur})</span>}</>;
        } else if (details.duration) {
            const dur = DURATION_OPTIONS.find((d) => d.value === details.duration);
            timeContent = <>{start}{dur && <span className="ml-2 text-xs text-tertiary">({dur.label})</span>}</>;
        } else {
            timeContent = start;
        }
        rows.push({ icon: Clock, label: "Time", content: timeContent });
    }
    if (details.location_name || details.location_address) {
        rows.push({
            icon: MarkerPin01,
            label: "Location",
            content: (
                <span className="flex flex-col gap-0.5">
                    {details.location_name && <span className="font-medium text-primary">{details.location_name}</span>}
                    {details.location_address && <span className="text-tertiary">{details.location_address}</span>}
                    {details.location_maps_url && (
                        <a href={details.location_maps_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-secondary hover:text-brand-primary transition duration-100 ease-linear mt-0.5">
                            <LinkExternal01 className="size-3.5" />View on map
                        </a>
                    )}
                </span>
            ),
        });
    }

    if (rows.length === 0) return null;

    return (
        <div className="bg-primary rounded-2xl border border-secondary divide-y divide-secondary">
            {rows.map(({ icon: Icon, label, content }) => (
                <div key={label} className="flex items-start gap-4 px-5 py-4">
                    <div className="flex items-center gap-2 w-24 flex-shrink-0 pt-0.5">
                        <Icon className="size-4 text-quaternary" />
                        <span className="text-xs font-semibold text-tertiary">{label}</span>
                    </div>
                    <div className="text-sm text-secondary flex-1">{content}</div>
                </div>
            ))}
        </div>
    );
}

function CommunityInfoCard({ info }: { info: string }) {
    const blocks = info.split(/\n{2,}/);
    return (
        <div className="bg-brand-secondary rounded-2xl border border-brand_alt p-6 space-y-4">
            {blocks.map((block, i) => {
                const lines = block.split("\n");
                const firstLine = lines[0].trim();
                const isSectionHeading = firstLine === firstLine.toUpperCase() && firstLine.length > 0 && firstLine.length < 40 && /[A-Z]/.test(firstLine);
                if (isSectionHeading) {
                    return (
                        <div key={i}>
                            <p className="text-xs font-semibold text-brand-secondary uppercase tracking-widest mb-2">{firstLine}</p>
                            {lines.slice(1).length > 0 && (
                                <div className="space-y-1">
                                    {lines.slice(1).map((line, j) => (
                                        <p key={j} className={cx("text-sm text-secondary", line.startsWith("-") || line.includes(" - ") ? "flex gap-2" : "")}>
                                            {line || " "}
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                }
                if (lines.length === 1 && firstLine.length < 50 && i === 0) {
                    return <p key={i} className="text-lg font-semibold text-primary">{firstLine}</p>;
                }
                return (
                    <div key={i} className="space-y-1">
                        {lines.map((line, j) => <p key={j} className="text-sm text-secondary leading-relaxed">{line || " "}</p>)}
                    </div>
                );
            })}
        </div>
    );
}

function RatingBadge({ rating }: { rating: number }) {
    const colors = ["", "bg-error-secondary text-error-primary", "bg-warning-primary text-warning-primary", "bg-secondary text-tertiary", "bg-brand-secondary text-brand-primary", "bg-success-primary text-success-primary", "bg-success-solid text-white"];
    return <span className={cx("text-xs font-semibold w-6 h-6 rounded-full flex items-center justify-center", colors[rating] ?? colors[3])}>{rating}</span>;
}

function AddMemberModal({ communityId, existing, onSave, onClose }: { communityId: string; existing: string[]; onSave: () => Promise<void>; onClose: () => void; }) {
    const [players, setPlayers] = useState<AllPlayer[]>([]);
    const [selected, setSelected] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const supabase = createClient();
    useEffect(() => {
        supabase.from("players").select("id, name, avatar_url").eq("is_active", true).order("name").then(({ data }) => {
            setPlayers((data ?? []).filter((p) => !existing.includes(p.id)));
        });
    }, []);
    const handleSave = async () => {
        setSaving(true);
        for (const pid of selected) {
            await supabase.from("community_members").insert({ community_id: communityId, player_id: pid, role: "player", rating: 3, position_bias: 3 });
        }
        await onSave(); setSaving(false);
    };
    const toggle = (id: string) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-overlay" onClick={onClose} />
            <div className="relative bg-primary rounded-2xl border border-secondary shadow-xl w-full max-w-sm">
                <div className="p-6">
                    <h2 className="text-lg font-semibold text-primary mb-4">Add Members</h2>
                    <div className="max-h-72 overflow-y-auto space-y-1">
                        {players.length === 0 && <p className="text-sm text-tertiary text-center py-4">All players already added</p>}
                        {players.map((p) => (
                            <button key={p.id} onClick={() => toggle(p.id)} className={cx("w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition duration-100 ease-linear", selected.includes(p.id) ? "bg-brand-secondary" : "hover:bg-primary_hover")}>
                                <div className="size-7 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-secondary flex-shrink-0">{p.avatar_url ? <img src={p.avatar_url} className="size-7 rounded-full object-cover" alt="" /> : p.name[0]}</div>
                                <span className="text-sm text-primary">{p.name}</span>
                                {selected.includes(p.id) && <Check className="size-4 text-brand-primary ml-auto" />}
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-3 mt-4">
                        <button onClick={onClose} className="flex-1 py-2.5 border border-primary text-sm font-semibold text-secondary rounded-lg hover:bg-primary_hover transition duration-100 ease-linear">Cancel</button>
                        <button onClick={handleSave} disabled={saving || selected.length === 0} className="flex-1 py-2.5 bg-brand-solid hover:bg-brand-solid_hover text-white text-sm font-semibold rounded-lg transition duration-100 ease-linear disabled:opacity-50">{saving ? "Adding..." : ("Add " + (selected.length > 0 ? selected.length : ""))}</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function EditMemberModal({ member, onSave, onClose }: { member: MemberWithPlayer; onSave: (data: Partial<CommunityMember>) => Promise<void>; onClose: () => void; }) {
    const [form, setForm] = useState({ rating: member.rating, position_bias: member.position_bias, is_goalkeeper: member.is_goalkeeper, gk_rating: member.gk_rating ?? member.rating, outfield_rating: member.outfield_rating ?? member.rating, role: member.role });
    const [saving, setSaving] = useState(false);
    const handleSubmit = async (e: React.FormEvent) => { e.preventDefault(); setSaving(true); await onSave({ ...form, gk_rating: form.is_goalkeeper ? form.gk_rating : null, outfield_rating: form.is_goalkeeper ? form.outfield_rating : null }); setSaving(false); };
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-overlay" onClick={onClose} />
            <div className="relative bg-primary rounded-2xl border border-secondary shadow-xl w-full max-w-sm">
                <div className="p-6">
                    <h2 className="text-lg font-semibold text-primary mb-1">Edit {member.player.name}</h2>
                    <p className="text-xs text-tertiary mb-5">Ratings are private - only admins can see them.</p>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-secondary mb-2">Community Role</label>
                            <div className="flex gap-2">{(["player", "admin"] as const).map((r) => (<button key={r} type="button" onClick={() => setForm((f) => ({ ...f, role: r }))} className={cx("flex-1 py-2 text-sm font-medium rounded-lg border transition duration-100 ease-linear capitalize", form.role === r ? "bg-brand-secondary border-brand text-brand-primary" : "border-secondary text-tertiary hover:bg-primary_hover")}>{r}</button>))}</div>
                        </div>
                        <RatingSlider label="Overall Rating" value={form.rating} onChange={(v) => setForm((f) => ({ ...f, rating: v }))} />
                        <div>
                            <label className="block text-sm font-medium text-secondary mb-2">Position: {POSITION_LABELS[form.position_bias - 1]}</label>
                            <input type="range" min={1} max={5} value={form.position_bias} onChange={(e) => setForm((f) => ({ ...f, position_bias: +e.target.value }))} className="w-full accent-brand-600" />
                            <div className="flex justify-between text-xs text-quaternary mt-1">{POSITION_LABELS.map((l) => <span key={l}>{l}</span>)}</div>
                        </div>
                        <div>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={form.is_goalkeeper} onChange={(e) => setForm((f) => ({ ...f, is_goalkeeper: e.target.checked }))} className="rounded accent-brand-600" />
                                <span className="text-sm font-medium text-secondary">Goalkeeper</span>
                            </label>
                            {form.is_goalkeeper && (
                                <div className="mt-3 space-y-3 pl-6">
                                    <RatingSlider label="GK Rating" value={form.gk_rating} onChange={(v) => setForm((f) => ({ ...f, gk_rating: v }))} />
                                    <RatingSlider label="Outfield Rating" value={form.outfield_rating} onChange={(v) => setForm((f) => ({ ...f, outfield_rating: v }))} />
                                </div>
                            )}
                        </div>
                        <div className="flex gap-3 pt-1">
                            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-primary text-sm font-semibold text-secondary rounded-lg hover:bg-primary_hover transition duration-100 ease-linear">Cancel</button>
                            <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-brand-solid hover:bg-brand-solid_hover text-white text-sm font-semibold rounded-lg transition duration-100 ease-linear disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default function CommunityDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const supabase = createClient();
    const { isSuperAdmin, adminCommunityIds } = useViewMode();
    const isAdmin = isSuperAdmin || adminCommunityIds.includes(id);

    const [community, setCommunity] = useState<Community | null>(null);
    const [members, setMembers] = useState<MemberWithPlayer[]>([]);
    const [events, setEvents] = useState<EventWithEnrollment[]>([]);
    const [myStats, setMyStats] = useState<CommunityStats | null>(null);
    const [communityStats, setCommunityStats] = useState<{ totalGames: number; totalGoals: number; totalAssists: number; topScorers: { playerId: string; name: string; avatar: string | null; goals: number; assists: number }[]; topPotm: { playerId: string; name: string; avatar: string | null; count: number }[] } | null>(null);
    const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
    const [myPlayerName, setMyPlayerName] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<Tab>("members");
    const [showAdd, setShowAdd] = useState(false);
    const [editingMember, setEditingMember] = useState<MemberWithPlayer | null>(null);
    const [enrollingId, setEnrollingId] = useState<string | null>(null);
    const [settingsForm, setSettingsForm] = useState({ community_name: "", sport_type: "", payment_currency: "£", payment_link: "", payment_amount: "", payment_message: "", bank_details: "", info: "" });
    const [detailsForm, setDetailsForm] = useState({ gender: "" as "male" | "female" | "mixed" | "", turf: "", days: [] as string[], start_time: "", end_time: "", duration: "", location_name: "", location_address: "", location_maps_url: "" });
    const [savingSettings, setSavingSettings] = useState(false);
    const [settingsSaved, setSettingsSaved] = useState(false);

    const handleSettingsSave = async () => {
        setSavingSettings(true);
        const newName = settingsForm.community_name.trim() || community!.name;
        const newDetails = Object.values(detailsForm).some((v) => (Array.isArray(v) ? v.length > 0 : !!v)) ? detailsForm : null;
        const updatePayload: any = {
            name: newName,
            sport_type: settingsForm.sport_type || null,
            default_payment_link: settingsForm.payment_link || null,
            default_payment_amount: settingsForm.payment_amount ? parseFloat(settingsForm.payment_amount) : null,
            default_payment_message: settingsForm.payment_message || null,
            bank_details: settingsForm.bank_details || null,
            info: settingsForm.info || null,
            community_details: newDetails,
        };
        // Only include payment_currency if it exists in schema (migration 007)
        if (community?.payment_currency !== undefined) {
            updatePayload.payment_currency = settingsForm.payment_currency || "£";
        }
        const { error } = await supabase.from("communities").update(updatePayload).eq("id", id);
        setSavingSettings(false);
        if (error?.message) {
            console.error("Settings save failed:", error.message);
            return;
        }
        // Update local community state directly so the header reflects changes immediately
        setCommunity((c) => c ? {
            ...c,
            name: newName,
            sport_type: settingsForm.sport_type || null,
            payment_currency: settingsForm.payment_currency || "£",
            default_payment_link: settingsForm.payment_link || null,
            default_payment_amount: settingsForm.payment_amount ? parseFloat(settingsForm.payment_amount) : null,
            default_payment_message: settingsForm.payment_message || null,
            bank_details: settingsForm.bank_details || null,
            info: settingsForm.info || null,
            community_details: newDetails,
        } as any : c);
        setSettingsSaved(true);
        setTimeout(() => setSettingsSaved(false), 3000);
    };

    const load = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        const [{ data: comm }, { data: profile }] = await Promise.all([
            supabase.from("communities").select("*").eq("id", id).single(),
            user ? supabase.from("user_profiles").select("player_id").eq("id", user.id).single() : Promise.resolve({ data: null }),
        ]);
        if (!comm) { router.push("/communities"); return; }
        setCommunity(comm);
        setSettingsForm({ community_name: comm.name ?? "", sport_type: comm.sport_type ?? "", payment_currency: comm.payment_currency ?? "£", payment_link: comm.default_payment_link ?? "", payment_amount: comm.default_payment_amount?.toString() ?? "", payment_message: comm.default_payment_message ?? "", bank_details: comm.bank_details ?? "", info: comm.info ?? "" });
        const cd = (comm.community_details as any) ?? {};
        setDetailsForm({ gender: cd.gender ?? "", turf: cd.turf ?? "", days: cd.days ?? [], start_time: cd.start_time ?? "", end_time: cd.end_time ?? "", duration: cd.duration ?? "", location_name: cd.location_name ?? "", location_address: cd.location_address ?? "", location_maps_url: cd.location_maps_url ?? "" });
        const playerId = (profile as any)?.player_id ?? null;
        setMyPlayerId(playerId);

        const [{ data: mem }, { data: evs }, playerNameRes] = await Promise.all([
            supabase.from("community_members").select("*, player:players(id, name, avatar_url)").eq("community_id", id).order("role", { ascending: true }),
            supabase.from("match_events").select("*").eq("community_id", id).order("event_date", { ascending: false }),
            playerId ? supabase.from("players").select("name").eq("id", playerId).single() : Promise.resolve({ data: null }),
        ]);
        setMembers((mem as unknown as MemberWithPlayer[]) ?? []);
        setMyPlayerName((playerNameRes.data as any)?.name ?? "");

        const evList = (evs ?? []) as any[];
        const completedEvIds = evList.filter((e) => e.status === "completed").map((e) => e.id);

        // Always load community-wide goals for the stats leaderboard
        const { data: allGoals } = completedEvIds.length > 0
            ? await supabase.from("goals").select("scorer_id, assister_id").in("event_id", completedEvIds)
            : { data: [] };

        // Build player name/avatar map from members
        const memberMap: Record<string, { name: string; avatar: string | null }> = {};
        (mem as any[] ?? []).forEach((m: any) => { memberMap[m.player_id] = { name: m.player?.name ?? "Unknown", avatar: m.player?.avatar_url ?? null }; });

        // Community-wide aggregates
        const goalMap: Record<string, { goals: number; assists: number }> = {};
        (allGoals ?? []).forEach((g: any) => {
            if (!goalMap[g.scorer_id]) goalMap[g.scorer_id] = { goals: 0, assists: 0 };
            goalMap[g.scorer_id].goals++;
            if (g.assister_id) {
                if (!goalMap[g.assister_id]) goalMap[g.assister_id] = { goals: 0, assists: 0 };
                goalMap[g.assister_id].assists++;
            }
        });
        const potmMap: Record<string, number> = {};
        evList.forEach((e: any) => { if (e.player_of_match_id) potmMap[e.player_of_match_id] = (potmMap[e.player_of_match_id] ?? 0) + 1; });

        const topScorers = Object.entries(goalMap)
            .map(([pid, s]) => ({ playerId: pid, name: memberMap[pid]?.name ?? "Unknown", avatar: memberMap[pid]?.avatar ?? null, ...s }))
            .sort((a, b) => b.goals - a.goals || b.assists - a.assists)
            .slice(0, 5);
        const topPotm = Object.entries(potmMap)
            .map(([pid, count]) => ({ playerId: pid, name: memberMap[pid]?.name ?? "Unknown", avatar: memberMap[pid]?.avatar ?? null, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        setCommunityStats({
            totalGames: completedEvIds.length,
            totalGoals: (allGoals ?? []).length,
            totalAssists: (allGoals ?? []).filter((g: any) => g.assister_id).length,
            topScorers,
            topPotm,
        });

        if (playerId && evList.length > 0) {
            const { data: enrollments } = await supabase.from("event_enrollments").select("event_id, id, is_enrolled").eq("player_id", playerId).in("event_id", evList.map((e) => e.id));
            const enrollMap: Record<string, { id: string; is_enrolled: boolean }> = {};
            (enrollments ?? []).forEach((e: any) => { enrollMap[e.event_id] = { id: e.id, is_enrolled: e.is_enrolled }; });
            setEvents(evList.map((e) => ({ ...e, isEnrolled: enrollMap[e.id]?.is_enrolled ?? false, enrollmentId: enrollMap[e.id]?.id ?? null })));
            let gp = 0; let goalCount = 0; let assistCount = 0; let potm = 0;
            evList.forEach((ev: any) => {
                if (ev.team_blue_ids?.includes(playerId) || ev.team_orange_ids?.includes(playerId)) gp++;
                if (ev.player_of_match_id === playerId) potm++;
            });
            (allGoals ?? []).forEach((g: any) => { if (g.scorer_id === playerId) goalCount++; if (g.assister_id === playerId) assistCount++; });
            setMyStats({ gp, goals: goalCount, assists: assistCount, potm });
        } else {
            setEvents(evList.map((e) => ({ ...e, isEnrolled: false, enrollmentId: null })));
        }
        setLoading(false);
    };

    useEffect(() => { load(); }, [id]);

    const handleEditSave = async (data: Partial<CommunityMember>) => {
        if (!editingMember) return;

        // If setting as admin, check if the player's user has a player_id, if not create one
        if (data.role === "admin") {
            const { data: userProfile } = await supabase
                .from("user_profiles")
                .select("player_id")
                .eq("player_id", editingMember.player_id)
                .single();

            // If no user is linked to this player, create a player for the admin if needed
            if (!userProfile?.player_id && editingMember.player_id) {
                // Player exists, just make sure the community_members entry has the admin role
            }
        }

        const updateData = {
            rating: data.rating,
            position_bias: data.position_bias,
            is_goalkeeper: data.is_goalkeeper,
            gk_rating: data.gk_rating,
            outfield_rating: data.outfield_rating,
            role: data.role
        };
        await supabase.from("community_members").update(updateData).eq("id", editingMember.id);
        setEditingMember(null);
        await load();
    };
    const handleRemove = async (memberId: string) => { await supabase.from("community_members").delete().eq("id", memberId); await load(); };
    const toggleEnroll = async (event: EventWithEnrollment) => {
        if (!myPlayerId) return;
        setEnrollingId(event.id);
        if (event.enrollmentId) {
            await supabase.from("event_enrollments").update({ is_enrolled: !event.isEnrolled }).eq("id", event.enrollmentId);
        } else {
            await supabase.from("event_enrollments").insert({ event_id: event.id, player_id: myPlayerId, is_enrolled: true, form_rating: "neutral" });
        }
        setEnrollingId(null); await load();
    };

    if (loading) return <div className="flex items-center justify-center h-64"><div className="size-8 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>;
    if (!community) return null;

    const admins = members.filter((m) => m.role === "admin");
    const players = members.filter((m) => m.role === "player");
    const upcomingEvents = events.filter((e) => e.status === "scheduled");
    const pastEvents = events.filter((e) => e.status !== "scheduled");
    const tabs: { id: Tab; label: string; icon: React.FC<any> }[] = [
        { id: "members", label: "Members", icon: Users01 },
        { id: "matchdays", label: "Match Days", icon: Calendar },
        { id: "stats", label: "Stats", icon: BarChart01 },
        ...(isAdmin ? [{ id: "settings" as Tab, label: "Settings", icon: Settings01 }] : []),
    ];

    return (
        <div className="max-w-2xl space-y-6">
            <Link href="/communities" className="inline-flex items-center gap-1.5 text-sm text-tertiary hover:text-primary transition duration-100 ease-linear">
                <ArrowLeft className="size-4" />Communities
            </Link>
            <div className="bg-primary rounded-2xl border border-secondary p-6">
                <div className="flex items-start gap-4">
                    <div className="flex size-14 items-center justify-center rounded-xl bg-brand-secondary flex-shrink-0"><Shield01 className="size-6 text-brand-primary" /></div>
                    <div className="flex-1">
                        <h1 className="text-2xl font-semibold text-primary">{community.name}</h1>
                        {community.sport_type && <span className="mt-1 inline-block px-2 py-0.5 rounded-full bg-brand-secondary text-brand-primary text-xs font-semibold">{community.sport_type}</span>}
                        <div className="flex flex-wrap gap-4 mt-3 text-sm text-tertiary">
                            <span className="flex items-center gap-1.5"><Users01 className="size-4" />{members.length} {members.length === 1 ? "member" : "members"}</span>
                            {community.default_payment_amount && <span>{community.payment_currency ?? "£"}{community.default_payment_amount} per game</span>}
                        </div>
                    </div>
                    {isAdmin && tab === "members" && (
                        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-3 py-2 bg-brand-solid hover:bg-brand-solid_hover text-white text-sm font-semibold rounded-lg transition duration-100 ease-linear">
                            <Plus className="size-4" /> Add
                        </button>
                    )}
                </div>
            </div>
            {community.community_details && <CommunityDetailsCard details={community.community_details} />}
            {community.info && <CommunityInfoCard info={community.info} />}
            <div className="flex gap-1 bg-secondary rounded-lg p-1 w-fit">
                {tabs.map(({ id: tid, label, icon: Icon }) => (
                    <button key={tid} onClick={() => setTab(tid)} className={cx("flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition duration-100 ease-linear", tab === tid ? "bg-primary text-primary shadow-sm" : "text-tertiary hover:text-secondary")}>
                        <Icon className="size-4" />{label}
                    </button>
                ))}
            </div>

            {tab === "members" && (<>
                {admins.length > 0 && (
                    <div className="bg-primary rounded-2xl border border-secondary p-6">
                        <h2 className="text-sm font-semibold text-secondary mb-4 flex items-center gap-2"><Star01 className="size-4 text-warning-primary" />Admins ({admins.length})</h2>
                        <div className="space-y-2">{admins.map((m) => (
                            <div key={m.id} className="flex items-center gap-3">
                                <div className="size-9 rounded-full bg-secondary flex items-center justify-center text-sm font-semibold text-secondary flex-shrink-0">{m.player.avatar_url ? <img src={m.player.avatar_url} className="size-9 rounded-full object-cover" alt="" /> : m.player.name[0]}</div>
                                <div className="flex-1"><p className="text-sm font-medium text-primary">{m.player.name}</p><p className="text-xs text-tertiary">{POSITION_LABELS[m.position_bias - 1]}{m.is_goalkeeper ? " - GK" : ""}</p></div>
                                {isAdmin && <div className="flex items-center gap-1"><RatingBadge rating={m.rating} /><button onClick={() => setEditingMember(m)} className="p-1.5 text-quaternary hover:text-secondary transition duration-100 ease-linear"><Edit01 className="size-4" /></button><button onClick={() => handleRemove(m.id)} className="p-1.5 text-quaternary hover:text-error-primary transition duration-100 ease-linear"><Trash01 className="size-4" /></button></div>}
                            </div>
                        ))}</div>
                    </div>
                )}
                <div className="bg-primary rounded-2xl border border-secondary p-6">
                    <h2 className="text-sm font-semibold text-secondary mb-4 flex items-center gap-2"><Users01 className="size-4 text-quaternary" />Players ({players.length})</h2>
                    {players.length === 0 ? <p className="text-sm text-tertiary">No players yet.</p> : (
                        <div className="space-y-2">{players.map((m) => (
                            <div key={m.id} className="flex items-center gap-3">
                                <div className="size-9 rounded-full bg-secondary flex items-center justify-center text-sm font-semibold text-secondary flex-shrink-0">{m.player.avatar_url ? <img src={m.player.avatar_url} className="size-9 rounded-full object-cover" alt="" /> : m.player.name[0]}</div>
                                <div className="flex-1"><p className="text-sm font-medium text-primary">{m.player.name}</p><p className="text-xs text-tertiary">{POSITION_LABELS[m.position_bias - 1]}{m.is_goalkeeper ? " - GK" : ""}</p></div>
                                {isAdmin && <div className="flex items-center gap-1"><RatingBadge rating={m.rating} /><button onClick={() => setEditingMember(m)} className="p-1.5 text-quaternary hover:text-secondary transition duration-100 ease-linear"><Edit01 className="size-4" /></button><button onClick={() => handleRemove(m.id)} className="p-1.5 text-quaternary hover:text-error-primary transition duration-100 ease-linear"><Trash01 className="size-4" /></button></div>}
                            </div>
                        ))}</div>
                    )}
                </div>
            </>)}

            {tab === "matchdays" && (
                <div className="space-y-4">
                    {upcomingEvents.length === 0 && pastEvents.length === 0 && (
                        <div className="text-center py-16 bg-primary rounded-2xl border border-secondary"><Calendar className="size-10 mx-auto mb-3 text-quaternary" /><p className="text-sm text-tertiary">No match days yet for this community.</p></div>
                    )}
                    {upcomingEvents.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold text-quaternary uppercase tracking-wide mb-2">Upcoming</p>
                            <div className="space-y-3">{upcomingEvents.map((event) => (
                                <div key={event.id} className="flex items-center gap-4 bg-primary rounded-xl border border-secondary p-4">
                                    <div className="flex size-12 items-center justify-center rounded-xl bg-brand-secondary flex-shrink-0"><Calendar className="size-5 text-brand-primary" /></div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-primary truncate">{event.title}</p>
                                        <div className="flex items-center gap-3 text-xs text-tertiary mt-0.5">
                                            <span className="flex items-center gap-1"><Clock className="size-3.5" />{new Date(event.event_date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} - {event.event_time?.slice(0, 5)}</span>
                                            {event.location && <span className="flex items-center gap-1"><MarkerPin01 className="size-3.5" />{event.location}</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {myPlayerId && (
                                            <button onClick={() => toggleEnroll(event)} disabled={enrollingId === event.id} className={cx("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition duration-100 ease-linear disabled:opacity-50", event.isEnrolled ? "bg-error-secondary text-error-primary hover:bg-error-primary" : "bg-brand-solid hover:bg-brand-solid_hover text-white")}>
                                                {event.isEnrolled ? <><XCircle className="size-3.5" />Leave</> : <><CheckCircle className="size-3.5" />Join</>}
                                            </button>
                                        )}
                                        <Link href={"/events/" + event.id} className="p-1.5 text-quaternary hover:text-secondary transition duration-100 ease-linear text-xs font-medium">View</Link>
                                    </div>
                                </div>
                            ))}</div>
                        </div>
                    )}
                    {pastEvents.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold text-quaternary uppercase tracking-wide mb-2">Past</p>
                            <div className="space-y-2">{pastEvents.slice(0, 10).map((event) => (
                                <Link key={event.id} href={"/events/" + event.id} className="flex items-center gap-3 bg-primary rounded-xl border border-secondary p-3 hover:border-brand hover:shadow-sm transition duration-100 ease-linear">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-primary truncate">{event.title}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <p className="text-xs text-tertiary">{new Date(event.event_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                                            {event.status === "completed" && <p className="text-xs font-semibold text-primary">Blue {event.score_blue} - {event.score_orange} Orange</p>}
                                        </div>
                                    </div>
                                    <span className={cx("text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0", event.status === "completed" ? "bg-success-primary text-success-primary" : "bg-warning-primary text-warning-primary")}>{event.status === "completed" ? "Completed" : "In Progress"}</span>
                                </Link>
                            ))}</div>
                        </div>
                    )}
                </div>
            )}

            {tab === "stats" && (
                <div className="space-y-6">
                    {/* Community totals */}
                    {communityStats && communityStats.totalGames > 0 ? (
                        <>
                            <div className="bg-primary rounded-2xl border border-secondary p-6">
                                <h2 className="text-base font-semibold text-primary mb-1">{community.name} — All Time</h2>
                                <p className="text-sm text-tertiary mb-5">Totals across all completed match days.</p>
                                <div className="grid grid-cols-3 gap-4">
                                    {[{ label: "Games", value: communityStats.totalGames }, { label: "Goals", value: communityStats.totalGoals }, { label: "Assists", value: communityStats.totalAssists }].map(({ label, value }) => (
                                        <div key={label} className="bg-secondary rounded-xl p-4 text-center">
                                            <p className="text-2xl font-bold text-primary">{value}</p>
                                            <p className="text-xs font-medium text-tertiary mt-1">{label}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Top scorers */}
                            {communityStats.topScorers.length > 0 && (
                                <div className="bg-primary rounded-2xl border border-secondary p-6">
                                    <h2 className="text-sm font-semibold text-secondary mb-4 flex items-center gap-2"><BarChart01 className="size-4 text-quaternary" />Top Scorers</h2>
                                    <div className="space-y-2">
                                        {communityStats.topScorers.map((p, i) => (
                                            <div key={p.playerId} className="flex items-center gap-3">
                                                <span className={cx("w-6 text-center text-sm font-bold flex-shrink-0", i === 0 ? "text-warning-primary" : i === 1 ? "text-quaternary" : i === 2 ? "text-tertiary" : "text-quaternary")}>{i + 1}</span>
                                                <div className="size-8 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-secondary flex-shrink-0">
                                                    {p.avatar ? <img src={p.avatar} className="size-8 rounded-full object-cover" alt="" /> : p.name[0]}
                                                </div>
                                                <span className="flex-1 text-sm font-medium text-primary truncate">{p.name}</span>
                                                <div className="flex items-center gap-3 text-sm flex-shrink-0">
                                                    <span className="font-bold text-primary">{p.goals} <span className="text-xs font-normal text-tertiary">G</span></span>
                                                    <span className="text-tertiary">{p.assists} <span className="text-xs text-quaternary">A</span></span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Top POTM */}
                            {communityStats.topPotm.length > 0 && (
                                <div className="bg-primary rounded-2xl border border-secondary p-6">
                                    <h2 className="text-sm font-semibold text-secondary mb-4 flex items-center gap-2"><Trophy01 className="size-4 text-warning-primary" />Player of the Match</h2>
                                    <div className="space-y-2">
                                        {communityStats.topPotm.map((p, i) => (
                                            <div key={p.playerId} className="flex items-center gap-3">
                                                <span className={cx("w-6 text-center text-sm font-bold flex-shrink-0", i === 0 ? "text-warning-primary" : "text-quaternary")}>{i + 1}</span>
                                                <div className="size-8 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-secondary flex-shrink-0">
                                                    {p.avatar ? <img src={p.avatar} className="size-8 rounded-full object-cover" alt="" /> : p.name[0]}
                                                </div>
                                                <span className="flex-1 text-sm font-medium text-primary truncate">{p.name}</span>
                                                <span className="text-sm font-bold text-warning-primary flex-shrink-0">{p.count}× <span className="text-xs font-normal text-tertiary">POTM</span></span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="bg-primary rounded-2xl border border-secondary p-6 text-center py-12">
                            <BarChart01 className="size-10 mx-auto mb-3 text-quaternary" />
                            <p className="text-sm text-tertiary">No completed match days yet — stats will appear here once games are finished.</p>
                        </div>
                    )}

                    {/* Personal stats */}
                    {myStats && (
                        <div className="bg-primary rounded-2xl border border-secondary p-6">
                            <h2 className="text-base font-semibold text-primary mb-1">My Stats</h2>
                            <p className="text-sm text-tertiary mb-5">Your personal record in {community.name}.</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                {[{ label: "Games", value: myStats.gp }, { label: "Goals", value: myStats.goals }, { label: "Assists", value: myStats.assists }, { label: "POTM", value: myStats.potm }].map(({ label, value }) => (
                                    <div key={label} className="bg-secondary rounded-xl p-4 text-center">
                                        <p className="text-2xl font-bold text-primary">{value}</p>
                                        <p className="text-xs font-medium text-tertiary mt-1">{label}</p>
                                    </div>
                                ))}
                            </div>
                            {myStats.potm > 0 && <div className="mt-5 flex items-center gap-2 text-sm text-warning-primary"><Trophy01 className="size-4" /><span>Player of the Match {myStats.potm} {myStats.potm === 1 ? "time" : "times"}</span></div>}
                        </div>
                    )}
                </div>
            )}

            {tab === "settings" && isAdmin && (
                <div className="space-y-6">
                    <div className="bg-primary rounded-2xl border border-secondary p-6">
                        <div className="flex items-center gap-3 mb-1">
                            <Shield01 className="size-5 text-brand-primary" />
                            <h2 className="text-base font-semibold text-primary">Community</h2>
                        </div>
                        <p className="text-sm text-tertiary mb-5 pl-8">Rename your community or change the sport type.</p>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-secondary mb-1.5">Community Name</label>
                                <input
                                    type="text"
                                    value={settingsForm.community_name ?? ""}
                                    onChange={(e) => setSettingsForm((f) => ({ ...f, community_name: e.target.value }))}
                                    placeholder="e.g. Monday Night FC"
                                    className="w-full px-3.5 py-2.5 rounded-lg border border-primary text-sm text-primary placeholder:text-placeholder bg-primary focus:outline-none focus:ring-2 focus:ring-brand transition duration-100 ease-linear"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-secondary mb-1.5">Sport</label>
                                <div className="relative">
                                    <select
                                        value={settingsForm.sport_type}
                                        onChange={(e) => setSettingsForm((f) => ({ ...f, sport_type: e.target.value }))}
                                        className="w-full appearance-none px-3.5 py-2.5 pr-9 rounded-lg border border-primary text-sm text-primary bg-primary focus:outline-none focus:ring-2 focus:ring-brand transition duration-100 ease-linear"
                                    >
                                        <option value="">Select sport…</option>
                                        {SPORT_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-quaternary" />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-primary rounded-2xl border border-secondary p-6">
                        <div className="flex items-center gap-3 mb-1">
                            <Settings01 className="size-5 text-brand-primary" />
                            <h2 className="text-base font-semibold text-primary">Community Info &amp; Rules</h2>
                        </div>
                        <p className="text-sm text-tertiary mb-5 pl-8">Welcome message, mission, rules, and any details you want all members to see on the community page.</p>
                        <textarea
                            rows={12}
                            value={settingsForm.info}
                            onChange={(e) => setSettingsForm((f) => ({ ...f, info: e.target.value }))}
                            placeholder={"Welcome to [Community Name]!\n\nMISSION\nDescribe your community's purpose and goals...\n\nRULES\n- Rule one\n- Rule two"}
                            className="w-full px-3.5 py-2.5 rounded-lg border border-primary text-sm text-primary placeholder:text-placeholder bg-primary focus:outline-none focus:ring-2 focus:ring-brand transition duration-100 ease-linear resize-none font-mono"
                        />
                    </div>
                    <div className="bg-primary rounded-2xl border border-secondary p-6">
                        <div className="flex items-center gap-3 mb-1">
                            <Calendar className="size-5 text-brand-primary" />
                            <h2 className="text-base font-semibold text-primary">Match Details</h2>
                        </div>
                        <p className="text-sm text-tertiary mb-6 pl-8">Shown as a structured info card on the community page for all members.</p>
                        {(() => {
                            const inputCls = "w-full px-3.5 py-2.5 rounded-lg border border-primary text-sm text-primary placeholder:text-placeholder bg-primary focus:outline-none focus:ring-2 focus:ring-brand transition duration-100 ease-linear";
                            const toggleBtn = (active: boolean) => cx("px-3 py-2 rounded-lg border text-sm font-medium transition duration-100 ease-linear", active ? "bg-brand-secondary border-brand text-brand-primary" : "border-secondary text-tertiary hover:bg-primary_hover");
                            const computed = calcDuration(detailsForm.start_time, detailsForm.end_time);
                            return (
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-secondary mb-2">Players</label>
                                        <div className="flex flex-wrap gap-2">
                                            {(["male", "female", "mixed"] as const).map((g) => (
                                                <button key={g} type="button" onClick={() => setDetailsForm((f) => ({ ...f, gender: f.gender === g ? "" : g }))} className={toggleBtn(detailsForm.gender === g)}>
                                                    {g === "male" ? "Male" : g === "female" ? "Female" : "Mixed Gender"}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-secondary mb-2">Turf / Pitch Type</label>
                                        <div className="relative">
                                            <select value={detailsForm.turf} onChange={(e) => setDetailsForm((f) => ({ ...f, turf: e.target.value }))} className={cx(inputCls, "appearance-none pr-9")}>
                                                <option value="">Select pitch type…</option>
                                                {TURF_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                            </select>
                                            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-quaternary" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-secondary mb-2">Day(s)</label>
                                        <div className="flex flex-wrap gap-2">
                                            {DAYS.map(({ value, label }) => (
                                                <button key={value} type="button"
                                                    onClick={() => setDetailsForm((f) => ({ ...f, days: f.days.includes(value) ? f.days.filter((d) => d !== value) : [...f.days, value] }))}
                                                    className={toggleBtn(detailsForm.days.includes(value))}
                                                >{label}</button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-secondary mb-2">Time</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <p className="text-xs text-tertiary mb-1">Start</p>
                                                <input type="time" value={detailsForm.start_time} onChange={(e) => setDetailsForm((f) => ({ ...f, start_time: e.target.value }))} className={inputCls} />
                                            </div>
                                            <div>
                                                <p className="text-xs text-tertiary mb-1">End (optional)</p>
                                                <input type="time" value={detailsForm.end_time} onChange={(e) => setDetailsForm((f) => ({ ...f, end_time: e.target.value }))} className={inputCls} />
                                            </div>
                                        </div>
                                        {detailsForm.start_time && detailsForm.end_time && computed && (
                                            <p className="text-xs text-tertiary mt-2">Duration: <span className="font-medium text-secondary">{computed}</span></p>
                                        )}
                                        {detailsForm.start_time && !detailsForm.end_time && (
                                            <div className="mt-3">
                                                <p className="text-xs text-tertiary mb-1">Duration</p>
                                                <div className="relative">
                                                    <select value={detailsForm.duration} onChange={(e) => setDetailsForm((f) => ({ ...f, duration: e.target.value }))} className={cx(inputCls, "appearance-none pr-9")}>
                                                        <option value="">Select duration…</option>
                                                        {DURATION_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                                                    </select>
                                                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-quaternary" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-3">
                                        <label className="block text-sm font-medium text-secondary">Location</label>
                                        <input type="text" value={detailsForm.location_name} onChange={(e) => setDetailsForm((f) => ({ ...f, location_name: e.target.value }))} placeholder="Facility name (e.g. Oasis Academy Hadley)" className={inputCls} />
                                        <textarea rows={2} value={detailsForm.location_address} onChange={(e) => setDetailsForm((f) => ({ ...f, location_address: e.target.value }))} placeholder="Street address, Town, Postcode" className={cx(inputCls, "resize-none")} />
                                        <input type="url" value={detailsForm.location_maps_url} onChange={(e) => setDetailsForm((f) => ({ ...f, location_maps_url: e.target.value }))} placeholder="Google Maps link (https://maps.google.com/…)" className={inputCls} />
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                    <div className="bg-primary rounded-2xl border border-secondary p-6">
                        <div className="flex items-center gap-3 mb-1">
                            <Link01 className="size-5 text-brand-primary" />
                            <h2 className="text-base font-semibold text-primary">Payment Link</h2>
                        </div>
                        <p className="text-sm text-tertiary mb-5 pl-8">Set a default payment link and amount that will pre-fill when creating new match day events.</p>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-secondary mb-1.5">Payment URL</label>
                                <input
                                    type="url"
                                    value={settingsForm.payment_link}
                                    onChange={(e) => setSettingsForm((f) => ({ ...f, payment_link: e.target.value }))}
                                    placeholder="https://monzo.me/yourname"
                                    className="w-full px-3.5 py-2.5 rounded-lg border border-primary text-sm text-primary placeholder:text-placeholder bg-primary focus:outline-none focus:ring-2 focus:ring-brand transition duration-100 ease-linear"
                                />
                            </div>
                            <div className="grid grid-cols-[auto_1fr] gap-2">
                                <div>
                                    <label className="block text-sm font-medium text-secondary mb-1.5">Currency</label>
                                    <select
                                        value={settingsForm.payment_currency}
                                        onChange={(e) => setSettingsForm((f) => ({ ...f, payment_currency: e.target.value }))}
                                        className="px-3.5 py-2.5 rounded-lg border border-primary text-sm text-primary bg-primary focus:outline-none focus:ring-2 focus:ring-brand transition duration-100 ease-linear"
                                    >
                                        <option value="£">£ (GBP)</option>
                                        <option value="€">€ (EUR)</option>
                                        <option value="$">$ (USD)</option>
                                        <option value="¥">¥ (JPY)</option>
                                        <option value="₹">₹ (INR)</option>
                                        <option value="₽">₽ (RUB)</option>
                                        <option value="CHF">CHF (CHF)</option>
                                        <option value="SEK">SEK (SEK)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-secondary mb-1.5">Amount</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.50"
                                        value={settingsForm.payment_amount}
                                        onChange={(e) => setSettingsForm((f) => ({ ...f, payment_amount: e.target.value }))}
                                        placeholder="5.00"
                                        className="w-full px-3.5 py-2.5 rounded-lg border border-primary text-sm text-primary placeholder:text-placeholder bg-primary focus:outline-none focus:ring-2 focus:ring-brand transition duration-100 ease-linear"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-secondary mb-1.5">Payment Message</label>
                                <textarea
                                    rows={2}
                                    value={settingsForm.payment_message}
                                    onChange={(e) => setSettingsForm((f) => ({ ...f, payment_message: e.target.value }))}
                                    placeholder="e.g. Pay for this week's match here 👇"
                                    className="w-full px-3.5 py-2.5 rounded-lg border border-primary text-sm text-primary placeholder:text-placeholder bg-primary focus:outline-none focus:ring-2 focus:ring-brand transition duration-100 ease-linear resize-none"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="bg-primary rounded-2xl border border-secondary p-6">
                        <div className="flex items-center gap-3 mb-1">
                            <Bank className="size-5 text-brand-primary" />
                            <h2 className="text-base font-semibold text-primary">Bank Transfer Details</h2>
                        </div>
                        <p className="text-sm text-tertiary mb-5 pl-8">Alternative to a payment link — players can transfer directly to your bank. Enter account name, sort code, and account number.</p>
                        <textarea
                            rows={4}
                            value={settingsForm.bank_details}
                            onChange={(e) => setSettingsForm((f) => ({ ...f, bank_details: e.target.value }))}
                            placeholder={"Account name: John Smith\nSort code: 12-34-56\nAccount number: 12345678"}
                            className="w-full px-3.5 py-2.5 rounded-lg border border-primary text-sm text-primary placeholder:text-placeholder bg-primary focus:outline-none focus:ring-2 focus:ring-brand transition duration-100 ease-linear resize-none"
                        />
                    </div>
                    <div className="flex items-center justify-end gap-3">
                        {settingsSaved && <span className="flex items-center gap-1.5 text-sm text-success-primary"><CheckCircle className="size-4" />Saved</span>}
                        <button
                            onClick={handleSettingsSave}
                            disabled={savingSettings}
                            className="px-5 py-2.5 bg-brand-solid hover:bg-brand-solid_hover text-white text-sm font-semibold rounded-lg transition duration-100 ease-linear disabled:opacity-50"
                        >
                            {savingSettings ? "Saving..." : "Save Settings"}
                        </button>
                    </div>
                </div>
            )}

            {showAdd && <AddMemberModal communityId={id} existing={members.map((m) => m.player_id)} onSave={async () => { await load(); setShowAdd(false); }} onClose={() => setShowAdd(false)} />}
            {editingMember && <EditMemberModal member={editingMember} onSave={handleEditSave} onClose={() => setEditingMember(null)} />}
        </div>
    );
}
