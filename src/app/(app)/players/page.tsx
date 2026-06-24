"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useViewMode } from "@/app/(app)/layout";
import type { Player, Community, FormRating } from "@/lib/football/types";
import { POSITION_LABELS } from "@/lib/football/types";
import {
    Plus,
    Edit02,
    Trash01,
    SearchSm,
    Shield01,
    Lightning01,
    Zap,
    Link01,
    User01,
    Upload01,
    Target01,
    Trophy01,
    Star01,
    Globe01,
    XClose,
    Check,
    ChevronDown,
} from "@untitledui/icons";
import { cx } from "@/utils/cx";

// DEF+, DEF, BAL, ATK, ATK+
const RATING_LABELS = ["Beginner", "Casual", "Intermediate", "Talented", "Advanced", "Pro"];

const FORM_CYCLE: FormRating[] = ["hot", "neutral", "cold"];
const FORM_CONFIG: Record<FormRating, { label: string; cls: string }> = {
    hot:     { label: "🔥 Hot",    cls: "bg-error-secondary text-error-primary border-error" },
    neutral: { label: "Neutral",   cls: "bg-secondary text-tertiary border-secondary" },
    cold:    { label: "❄️ Cold",   cls: "bg-brand-secondary text-brand-primary border-brand" },
};

function FormBadge({ form, isAdmin, onClick }: { form: FormRating | null; isAdmin: boolean; onClick?: () => void }) {
    const f = form ?? "neutral";
    const { label, cls } = FORM_CONFIG[f];
    if (!isAdmin) return null;
    return (
        <button
            type="button"
            title="Click to change form"
            onClick={onClick}
            className={cx("inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium transition duration-100 ease-linear", cls, onClick ? "hover:opacity-80 cursor-pointer" : "cursor-default")}
        >
            {label}
        </button>
    );
}

function AdminRatingSlider({ value, label, sub, onChange }: { value: number; label: string; sub?: string; onChange: (v: number) => void }) {
    const pct = ((value - 1) / 5) * 100;
    const bubbleLeft = `calc(${pct}% + ${(8 - pct * 0.16).toFixed(1)}px)`;
    return (
        <div>
            <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-secondary">
                    {label}{sub && <span className="ml-1.5 text-xs font-normal text-tertiary">{sub}</span>}
                </label>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-solid text-white">{RATING_LABELS[value - 1]}</span>
            </div>
            <div className="relative pt-6 pb-1">
                <div
                    className="absolute top-0 -translate-x-1/2 bg-brand-solid text-white text-xs font-semibold px-2 py-0.5 rounded-full pointer-events-none whitespace-nowrap shadow-sm transition-none"
                    style={{ left: bubbleLeft }}
                >
                    {RATING_LABELS[value - 1]}
                </div>
                <input type="range" min={1} max={6} value={value} onChange={(e) => onChange(+e.target.value)} className="w-full accent-brand-600" />
            </div>
            <div className="flex justify-between text-xs text-quaternary mt-1 px-0.5">
                {[1, 2, 3, 4, 5, 6].map((n) => <span key={n}>{n}</span>)}
            </div>
            <div className="flex justify-between text-xs text-quaternary mt-0.5 px-0.5">
                <span>Beginner</span><span>Pro</span>
            </div>
        </div>
    );
}

function positionInfo(bias: number) {
    if (bias === 1) return { label: "DEF+", icon: Shield01, color: "text-fg-brand-primary" };
    if (bias === 2) return { label: "DEF", icon: Shield01, color: "text-brand-secondary" };
    if (bias === 3) return { label: "BAL", icon: Zap, color: "text-tertiary" };
    if (bias === 4) return { label: "ATK", icon: Lightning01, color: "text-warning-primary" };
    return { label: "ATK+", icon: Lightning01, color: "text-error-primary" };
}

interface PlayerStats {
    games: number;
    goals: number;
    assists: number;
    potm: number;
}

interface PlayerFormData {
    name: string;
    rating: number;
    position_bias: number;
    is_goalkeeper: boolean;
    gk_rating: number;
    outfield_rating: number;
    is_active: boolean;
    is_public: boolean;
    avatar_url: string;
}

const DEFAULT_FORM: PlayerFormData = {
    name: "",
    rating: 3,
    position_bias: 3,
    is_goalkeeper: false,
    gk_rating: 3,
    outfield_rating: 3,
    is_active: true,
    is_public: false,
    avatar_url: "",
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <button
            type="button"
            onClick={() => onChange(!checked)}
            className={cx(
                "relative inline-flex h-6 w-11 items-center rounded-full transition duration-100 ease-linear",
                checked ? "bg-brand-solid" : "bg-tertiary",
            )}
        >
            <span className={cx(
                "inline-block size-4 rounded-full bg-white shadow transition duration-100 ease-linear",
                checked ? "translate-x-6" : "translate-x-1",
            )} />
        </button>
    );
}

function PlayerFormModal({ player, isAdmin, communities, onSave, onClose }: {
    player?: Player;
    isAdmin: boolean;
    communities: { id: string; name: string }[];
    onSave: (data: Partial<Player>, communityIds: string[]) => Promise<void>;
    onClose: () => void;
}) {
    const [selectedCommunities, setSelectedCommunities] = useState<string[]>([]);
    const [existingCommunityIds, setExistingCommunityIds] = useState<string[]>([]);
    const [communityDropdownOpen, setCommunityDropdownOpen] = useState(false);
    const [communitySearch, setCommunitySearch] = useState("");
    const communityDropdownRef = useRef<HTMLDivElement>(null);
    const [form, setForm] = useState<PlayerFormData>(
        player ? {
            name: player.name,
            rating: player.rating,
            position_bias: player.position_bias,
            is_goalkeeper: player.is_goalkeeper,
            gk_rating: player.gk_rating ?? 3,
            outfield_rating: player.outfield_rating ?? 3,
            is_active: player.is_active,
            is_public: (player as any).is_public ?? false,
            avatar_url: player.avatar_url ?? "",
        } : DEFAULT_FORM,
    );
    const [saving, setSaving] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const supabase = createClient();
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (player) {
            supabase.from("community_members").select("community_id").eq("player_id", player.id)
                .then(({ data }) => setExistingCommunityIds((data ?? []).map((m) => m.community_id)));
        }
    }, [player?.id]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (communityDropdownRef.current && !communityDropdownRef.current.contains(e.target as Node)) {
                setCommunityDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const availableCommunities = communities.filter((c) => !existingCommunityIds.includes(c.id));
    const filteredCommunities = availableCommunities.filter((c) =>
        c.name.toLowerCase().includes(communitySearch.toLowerCase())
    );

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingAvatar(true);
        setUploadError(null);

        try {
            const ext = file.name.split(".").pop()?.toLowerCase();
            if (!ext) {
                setUploadError("File must have an extension");
                setUploadingAvatar(false);
                return;
            }

            const path = `avatars/${Date.now()}.${ext}`;
            const { error, data } = await supabase.storage.from("squadIQ-assets").upload(path, file, { upsert: true });

            if (error) {
                setUploadError(error.message || "Upload failed");
                setUploadingAvatar(false);
                return;
            }

            const { data: publicUrlData } = supabase.storage.from("squadIQ-assets").getPublicUrl(path);
            setForm((f) => ({ ...f, avatar_url: publicUrlData.publicUrl }));
            if (fileRef.current) fileRef.current.value = "";
        } catch (err: any) {
            setUploadError(err?.message || "Upload failed");
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const payload: Partial<Player> = {
            name: form.name,
            position_bias: form.position_bias,
            is_goalkeeper: form.is_goalkeeper,
            is_active: form.is_active,
            is_public: form.is_public,
            avatar_url: form.avatar_url || null,
            ...(isAdmin && {
                rating: form.rating,
                gk_rating: form.is_goalkeeper ? form.gk_rating : null,
                outfield_rating: form.is_goalkeeper ? form.outfield_rating : null,
            }),
        } as any;
        await onSave(payload, selectedCommunities);
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-overlay" onClick={onClose} />
            <div className="relative bg-primary rounded-2xl border border-secondary shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <h2 className="text-lg font-semibold text-primary mb-5">{player ? "Edit Player" : "Add Player"}</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Avatar */}
                        <div className="flex items-center gap-4">
                            <div className="size-16 rounded-full bg-secondary border-2 border-secondary overflow-hidden flex items-center justify-center flex-shrink-0">
                                {form.avatar_url ? (
                                    <img src={form.avatar_url} alt="" className="size-full object-cover" />
                                ) : (
                                    <User01 className="size-8 text-quaternary" />
                                )}
                            </div>
                            <div>
                                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => fileRef.current?.click()} disabled={uploadingAvatar}
                                        className={cx("flex items-center gap-1.5 text-sm transition duration-100 ease-linear", uploadingAvatar ? "text-tertiary cursor-not-allowed opacity-50" : "text-brand-secondary hover:text-brand-secondary_hover")}>
                                        <Upload01 className="size-4" /> {uploadingAvatar ? "Uploading..." : "Upload photo"}
                                    </button>
                                    {form.avatar_url && (
                                        <button type="button" onClick={() => setForm((f) => ({ ...f, avatar_url: "" }))}
                                            className="flex items-center gap-1.5 text-sm text-error-primary hover:text-error-secondary transition duration-100 ease-linear">
                                            <Trash01 className="size-4" /> Remove
                                        </button>
                                    )}
                                </div>
                                {uploadError && <p className="text-xs text-error-primary mt-1">{uploadError}</p>}
                                <p className="text-xs text-tertiary mt-0.5">Shown on player card</p>
                            </div>
                        </div>

                        {/* Name */}
                        <div>
                            <label className="block text-sm font-medium text-secondary mb-1.5">Name</label>
                            <input type="text" value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                placeholder="Player name"
                                className="w-full px-3.5 py-2.5 rounded-lg border border-primary bg-primary text-primary text-sm placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-brand transition duration-100 ease-linear"
                                required />
                        </div>

                        {/* Rating — admin only */}
                        {isAdmin && !form.is_goalkeeper && (
                            <AdminRatingSlider label="Rating" sub="(admin only)" value={form.rating} onChange={(v) => setForm((f) => ({ ...f, rating: v }))} />
                        )}

                        {/* Position bias */}
                        <div>
                            <label className="block text-sm font-medium text-secondary mb-1.5">
                                Position: {POSITION_LABELS[form.position_bias - 1]}
                            </label>
                            <div className="flex items-center gap-2">
                                <Shield01 className="size-4 text-brand-secondary flex-shrink-0" />
                                <input type="range" min={1} max={5} value={form.position_bias}
                                    onChange={(e) => setForm((f) => ({ ...f, position_bias: +e.target.value }))}
                                    className="flex-1 accent-brand-600" />
                                <Lightning01 className="size-4 text-error-primary flex-shrink-0" />
                            </div>
                            <div className="flex justify-between text-xs text-quaternary mt-1">
                                {POSITION_LABELS.map((l) => <span key={l}>{l}</span>)}
                            </div>
                        </div>

                        {/* GK toggle */}
                        <div className="flex items-center justify-between p-3 rounded-lg border border-secondary">
                            <div>
                                <p className="text-sm font-medium text-primary">Can play Goalkeeper</p>
                                <p className="text-xs text-tertiary">Enables GK ratings</p>
                            </div>
                            <Toggle checked={form.is_goalkeeper} onChange={(v) => setForm((f) => ({ ...f, is_goalkeeper: v }))} />
                        </div>

                        {/* GK ratings — admin only */}
                        {isAdmin && form.is_goalkeeper && (
                            <>
                                <AdminRatingSlider label="GK Rating" sub="(goalkeeper)" value={form.gk_rating} onChange={(v) => setForm((f) => ({ ...f, gk_rating: v }))} />
                                <AdminRatingSlider label="Outfield Rating" sub="(when not in goal)" value={form.outfield_rating} onChange={(v) => setForm((f) => ({ ...f, outfield_rating: v }))} />
                            </>
                        )}

                        {/* Visibility */}
                        <div className="flex items-center justify-between p-3 rounded-lg border border-secondary">
                            <div>
                                <p className="text-sm font-medium text-primary flex items-center gap-1.5">
                                    <Globe01 className="size-4 text-quaternary" />
                                    Visible to all players
                                </p>
                                <p className="text-xs text-tertiary mt-0.5">Show your stats in the global player directory</p>
                            </div>
                            <Toggle checked={form.is_public} onChange={(v) => setForm((f) => ({ ...f, is_public: v }))} />
                        </div>

                        {/* Active — admin only */}
                        {isAdmin && (
                            <div className="flex items-center justify-between p-3 rounded-lg border border-secondary">
                                <p className="text-sm font-medium text-primary">Active player</p>
                                <Toggle checked={form.is_active} onChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
                            </div>
                        )}

                        {/* Community picker */}
                        {availableCommunities.length > 0 && (
                            <div className="pt-2 border-t border-secondary">
                                <label className="block text-sm font-medium text-secondary mb-1">
                                    Add to community
                                    <span className="ml-1.5 text-xs font-normal text-tertiary">optional</span>
                                </label>
                                <p className="text-xs text-tertiary mb-2">
                                    {player ? "Add this player to communities they're not yet in." : "Player will be added as a member with these settings."}
                                </p>

                                {/* Dropdown trigger */}
                                <div className="relative" ref={communityDropdownRef}>
                                    <button
                                        type="button"
                                        onClick={() => { setCommunityDropdownOpen((v) => !v); setCommunitySearch(""); }}
                                        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 border border-primary rounded-lg text-sm text-secondary bg-primary hover:bg-primary_hover transition duration-100 ease-linear"
                                    >
                                        <span className="flex items-center gap-2 min-w-0">
                                            <Shield01 className="size-4 text-quaternary shrink-0" />
                                            {selectedCommunities.length === 0
                                                ? <span className="text-placeholder">Select communities…</span>
                                                : <span className="truncate text-primary font-medium">
                                                    {selectedCommunities.length === 1
                                                        ? availableCommunities.find((c) => c.id === selectedCommunities[0])?.name
                                                        : `${selectedCommunities.length} communities selected`}
                                                  </span>
                                            }
                                        </span>
                                        <ChevronDown className={cx("size-4 text-quaternary shrink-0 transition duration-100", communityDropdownOpen && "rotate-180")} />
                                    </button>

                                    {communityDropdownOpen && (
                                        <div className="absolute z-50 mt-1 w-full bg-primary border border-secondary_alt rounded-xl shadow-lg overflow-hidden">
                                            {/* Search */}
                                            <div className="p-2 border-b border-secondary">
                                                <div className="flex items-center gap-2 px-3 py-2 bg-secondary rounded-lg">
                                                    <SearchSm className="size-4 text-quaternary shrink-0" />
                                                    <input
                                                        autoFocus
                                                        type="text"
                                                        placeholder="Search communities…"
                                                        value={communitySearch}
                                                        onChange={(e) => setCommunitySearch(e.target.value)}
                                                        className="flex-1 bg-transparent text-sm text-primary placeholder:text-placeholder outline-none"
                                                    />
                                                    {communitySearch && (
                                                        <button type="button" onClick={() => setCommunitySearch("")} className="text-quaternary hover:text-secondary">
                                                            <XClose className="size-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Options */}
                                            <div className="max-h-48 overflow-y-auto py-1">
                                                {filteredCommunities.length === 0 ? (
                                                    <p className="px-3 py-3 text-sm text-tertiary text-center">No communities found</p>
                                                ) : filteredCommunities.map((c) => {
                                                    const selected = selectedCommunities.includes(c.id);
                                                    return (
                                                        <button
                                                            key={c.id}
                                                            type="button"
                                                            onClick={() => setSelectedCommunities((prev) =>
                                                                selected ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                                                            )}
                                                            className={cx(
                                                                "w-full flex items-center gap-3 px-3 py-2.5 text-sm transition duration-100 ease-linear",
                                                                selected ? "bg-active text-primary" : "text-secondary hover:bg-primary_hover",
                                                            )}
                                                        >
                                                            <div className={cx(
                                                                "size-4 rounded border flex items-center justify-center shrink-0 transition duration-100",
                                                                selected ? "bg-brand-solid border-brand" : "border-primary bg-primary",
                                                            )}>
                                                                {selected && <Check className="size-3 text-white" />}
                                                            </div>
                                                            <Shield01 className="size-4 text-quaternary shrink-0" />
                                                            <span className="flex-1 text-left truncate font-medium">{c.name}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            {/* Footer — show selections */}
                                            {selectedCommunities.length > 0 && (
                                                <div className="border-t border-secondary px-3 py-2 flex items-center justify-between">
                                                    <span className="text-xs text-tertiary">{selectedCommunities.length} selected</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedCommunities([])}
                                                        className="text-xs text-brand-secondary hover:text-brand-primary transition duration-100 ease-linear"
                                                    >
                                                        Clear all
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Selected chips */}
                                {selectedCommunities.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                        {selectedCommunities.map((id) => {
                                            const c = availableCommunities.find((x) => x.id === id);
                                            if (!c) return null;
                                            return (
                                                <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-secondary text-brand-primary text-xs font-medium">
                                                    {c.name}
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedCommunities((prev) => prev.filter((x) => x !== id))}
                                                        className="hover:text-brand-primary ml-0.5"
                                                    >
                                                        <XClose className="size-3" />
                                                    </button>
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={onClose}
                                className="flex-1 py-2.5 px-4 border border-primary text-sm font-semibold text-secondary rounded-lg hover:bg-primary_hover transition duration-100 ease-linear">
                                Cancel
                            </button>
                            <button type="submit" disabled={saving}
                                className="flex-1 py-2.5 px-4 bg-brand-solid hover:bg-brand-solid_hover text-white text-sm font-semibold rounded-lg transition duration-100 ease-linear disabled:opacity-50">
                                {saving ? "Saving..." : (selectedCommunities.length > 0 ? `Save & Add to ${selectedCommunities.length === 1 ? "1 community" : `${selectedCommunities.length} communities`}` : "Save")}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

function LinkUserModal({ player, onSave, onClose }: {
    player: Player;
    onSave: (userId: string | null) => Promise<void>;
    onClose: () => void;
}) {
    const [users, setUsers] = useState<{ id: string; full_name: string; role: string }[]>([]);
    const [search, setSearch] = useState("");
    const [saving, setSaving] = useState(false);
    const supabase = createClient();

    useEffect(() => {
        supabase.from("user_profiles").select("id, full_name, role").then(({ data }) => setUsers(data ?? []));
    }, []);

    const filtered = users.filter((u) => u.full_name?.toLowerCase().includes(search.toLowerCase()));

    const handleLink = async (userId: string | null) => {
        setSaving(true);
        await onSave(userId);
        setSaving(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-overlay" onClick={onClose} />
            <div className="relative bg-primary rounded-2xl border border-secondary shadow-xl w-full max-w-sm">
                <div className="p-6">
                    <h2 className="text-base font-semibold text-primary mb-1">Link User Account</h2>
                    <p className="text-sm text-tertiary mb-4">Link <strong className="text-primary">{player.name}</strong> to a registered user.</p>
                    <div className="relative mb-3">
                        <SearchSm className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-quaternary" />
                        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search users..."
                            className="w-full pl-9 pr-3.5 py-2 rounded-lg border border-primary bg-primary text-primary text-sm placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-brand transition duration-100 ease-linear" />
                    </div>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                        {player.user_id && (
                            <button onClick={() => handleLink(null)} disabled={saving}
                                className="w-full text-left px-3 py-2 rounded-lg text-sm text-error-primary hover:bg-error-primary transition duration-100 ease-linear">
                                Unlink current user
                            </button>
                        )}
                        {filtered.map((u) => (
                            <button key={u.id} onClick={() => handleLink(u.id)} disabled={saving}
                                className={cx(
                                    "w-full text-left px-3 py-2 rounded-lg text-sm transition duration-100 ease-linear",
                                    u.id === player.user_id ? "bg-brand-primary_alt text-brand-primary" : "text-secondary hover:bg-primary_hover",
                                )}>
                                <span className="font-medium">{u.full_name || "—"}</span>
                                <span className="text-tertiary ml-2 text-xs capitalize">{u.role}</span>
                                {u.id === player.user_id && <span className="text-xs text-brand-secondary ml-2">✓ Linked</span>}
                            </button>
                        ))}
                    </div>
                    <button onClick={onClose} className="w-full mt-4 py-2 text-sm text-tertiary hover:text-secondary transition duration-100 ease-linear">Cancel</button>
                </div>
            </div>
        </div>
    );
}

function StatsRow({ stats }: { stats: PlayerStats }) {
    return (
        <div className="grid grid-cols-4 gap-1 text-center">
            {[
                { label: "GP", value: stats.games, icon: null },
                { label: "G", value: stats.goals, icon: Target01 },
                { label: "A", value: stats.assists, icon: null },
                { label: "POTM", value: stats.potm, icon: Trophy01 },
            ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-secondary rounded-lg py-1.5">
                    <p className="text-sm font-bold text-primary">{value}</p>
                    <p className="text-xs text-quaternary">{label}</p>
                </div>
            ))}
        </div>
    );
}

function PlayerCard({ player, stats, isAdmin, isPublic, communityNames, showCommunities, hasLinkedAccount, onEdit, onDelete, onLink, onFormChange }: {
    player: Player;
    stats: PlayerStats;
    isAdmin: boolean;
    isPublic: boolean;
    communityNames: string[];
    showCommunities: boolean;
    hasLinkedAccount?: boolean;
    onEdit: () => void;
    onDelete: () => void;
    onLink: () => void;
    onFormChange?: (form: FormRating) => void;
}) {
    const pos = positionInfo(player.position_bias);
    const PosIcon = pos.icon;

    const cycleForm = () => {
        if (!onFormChange) return;
        const current = player.form_rating ?? "neutral";
        const next = FORM_CYCLE[(FORM_CYCLE.indexOf(current) + 1) % FORM_CYCLE.length];
        onFormChange(next);
    };

    return (
        <div className={cx("bg-primary rounded-2xl border border-secondary overflow-hidden relative flex flex-col", !player.is_active && "opacity-60")}>
            {/* Header row: avatar | name+pos | rating block */}
            <div className="flex items-stretch gap-3 p-4 pb-3">
                {/* Circular avatar */}
                <div className="relative flex-shrink-0 self-center">
                    <div className="size-28 rounded-full bg-secondary border-2 border-secondary overflow-hidden flex items-center justify-center">
                        {player.avatar_url ? (
                            <img src={player.avatar_url} alt={player.name} className="size-full object-cover" />
                        ) : (
                            <User01 className="size-10 text-quaternary" />
                        )}
                    </div>
                    <div className={cx("absolute bottom-0.5 right-0.5 size-3.5 rounded-full border-2 border-primary", player.user_id ? "bg-success-solid" : "bg-quaternary")} />
                </div>

                {/* Name + position + form */}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-start gap-1">
                        <p className="text-base font-bold text-primary leading-tight truncate">{player.name}</p>
                        {isPublic && <Globe01 className="size-3.5 text-quaternary flex-shrink-0 mt-0.5" />}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <PosIcon className={cx("size-3.5", pos.color)} />
                        <span className={cx("text-xs font-medium", pos.color)}>{pos.label}</span>
                        {player.is_goalkeeper && (
                            <span className="text-xs font-semibold text-warning-primary bg-warning-primary rounded px-1">GK</span>
                        )}
                        {hasLinkedAccount && (
                            <span className="text-xs font-semibold text-success-primary bg-success-primary rounded px-1">Linked</span>
                        )}
                    </div>
                    {isAdmin && (
                        <div className="mt-1.5">
                            <FormBadge form={player.form_rating ?? "neutral"} isAdmin={isAdmin} onClick={cycleForm} />
                        </div>
                    )}
                </div>

                {/* Rating block — matches avatar height, admin only */}
                {isAdmin && (
                    <div className="flex-shrink-0 flex flex-col items-center justify-center rounded-xl bg-secondary w-14 self-stretch">
                        {player.is_goalkeeper ? (
                            <>
                                <p className="text-2xl font-black text-primary leading-none">{player.gk_rating ?? "—"}</p>
                                <p className="text-[10px] font-semibold text-warning-primary mt-0.5">GK</p>
                                <div className="w-px h-3 bg-tertiary my-1" />
                                <p className="text-2xl font-black text-primary leading-none">{player.outfield_rating ?? "—"}</p>
                                <p className="text-[10px] font-semibold text-tertiary mt-0.5">Field</p>
                            </>
                        ) : (
                            <>
                                <p className="text-4xl font-black text-primary leading-none">{player.rating}</p>
                                <p className="text-[10px] font-semibold text-quaternary mt-1 uppercase tracking-wide">Rating</p>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Body */}
            <div className="px-4 pb-4 flex flex-col gap-2.5 flex-1">
                {/* Stats */}
                <StatsRow stats={stats} />

                {/* Community badges */}
                {showCommunities && communityNames.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {communityNames.map((name, i) => (
                            <span key={`${name}-${i}`} className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-brand-secondary text-brand-primary">
                                {name}
                            </span>
                        ))}
                    </div>
                )}
                {showCommunities && communityNames.length === 0 && (
                    <p className="text-xs text-quaternary">No community</p>
                )}

                {/* Admin actions */}
                {isAdmin && (
                    <div className="flex gap-1.5 pt-0.5">
                        <button onClick={onLink}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-tertiary hover:text-primary border border-secondary hover:border-primary rounded-lg transition duration-100 ease-linear">
                            <Link01 className="size-3.5" /> Link
                        </button>
                        <button onClick={onEdit}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-tertiary hover:text-primary border border-secondary hover:border-primary rounded-lg transition duration-100 ease-linear">
                            <Edit02 className="size-3.5" /> Edit
                        </button>
                        <button onClick={onDelete}
                            className="flex items-center justify-center p-1.5 text-error-primary hover:bg-error-primary rounded-lg border border-transparent hover:border-error transition duration-100 ease-linear">
                            <Trash01 className="size-3.5" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// Compute stats for a set of players from events + goals data
function computeStats(
    playerIds: string[],
    events: any[],
    goals: any[],
): Record<string, PlayerStats> {
    const map: Record<string, PlayerStats> = {};
    playerIds.forEach((id) => { map[id] = { games: 0, goals: 0, assists: 0, potm: 0 }; });

    events.forEach((ev) => {
        const allIds = [...(ev.team_blue_ids ?? []), ...(ev.team_orange_ids ?? [])];
        allIds.forEach((pid: string) => {
            if (map[pid]) map[pid].games++;
        });
        if (ev.player_of_match_id && map[ev.player_of_match_id]) {
            map[ev.player_of_match_id].potm++;
        }
    });

    goals.forEach((g: any) => {
        if (map[g.scorer_id]) map[g.scorer_id].goals++;
        if (g.assister_id && map[g.assister_id]) map[g.assister_id].assists++;
    });

    return map;
}

export default function PlayersPage() {
    const { isAdmin, isSuperAdmin, adminCommunityIds } = useViewMode();
    const supabase = createClient();

    const [players, setPlayers] = useState<(Player & { communityNames?: string[] })[]>([]);
    const [stats, setStats] = useState<Record<string, PlayerStats>>({});
    const [communities, setCommunities] = useState<Community[]>([]);
    // super admin default = "all"; others default to first community
    const [selectedTab, setSelectedTab] = useState<"all" | "global" | string>("all");
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [editingPlayer, setEditingPlayer] = useState<Player | undefined>();
    const [showForm, setShowForm] = useState(false);
    const [linkingPlayer, setLinkingPlayer] = useState<Player | null>(null);
    const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
    const [myCommunityIds, setMyCommunityIds] = useState<string[]>([]);
    const [sortBy, setSortBy] = useState<string>("name-asc");

    const loadData = async (tab: "all" | "global" | string, superAdmin: boolean, myCommunities: string[]) => {
        setLoading(true);

        if (tab === "all" && superAdmin) {
            // Super admin: ALL players with community names attached
            const { data: ps } = await supabase
                .from("players").select("*").eq("is_active", true).order("name");
            const playerIds = (ps ?? []).map((p) => p.id);

            // Fetch linked user accounts
            const { data: linkedAccounts } = await supabase
                .from("user_profiles")
                .select("player_id")
                .in("player_id", playerIds.length ? playerIds : ["none"]);

            const linkedPlayerIds = new Set((linkedAccounts ?? []).map((u: any) => u.player_id));

            // Fetch all community memberships + community names
            const { data: memberships } = await supabase
                .from("community_members")
                .select("player_id, community:communities(name)")
                .in("player_id", playerIds.length ? playerIds : ["none"]);

            const communityMap: Record<string, string[]> = {};
            (memberships ?? []).forEach((m: any) => {
                if (!communityMap[m.player_id]) communityMap[m.player_id] = [];
                if (m.community?.name && !communityMap[m.player_id].includes(m.community.name)) {
                    communityMap[m.player_id].push(m.community.name);
                }
            });

            const playersWithComms = (ps ?? []).map((p) => ({
                ...p,
                communityNames: communityMap[p.id] ?? [],
                hasLinkedAccount: linkedPlayerIds.has(p.id),
            }));

            const [eventsRes, goalsRes] = await Promise.all([
                supabase.from("match_events").select("team_blue_ids, team_orange_ids, player_of_match_id").eq("status", "completed"),
                supabase.from("goals").select("scorer_id, assister_id"),
            ]);
            setPlayers(playersWithComms);
            setStats(computeStats(playerIds, eventsRes.data ?? [], goalsRes.data ?? []));

        } else if (tab === "global") {
            // Global directory: only opted-in players visible to everyone
            const { data: ps } = await supabase
                .from("players").select("*").eq("is_active", true).eq("is_public", true).order("name");
            const playerIds = (ps ?? []).map((p) => p.id);

            // Fetch linked user accounts
            const { data: linkedAccounts } = await supabase
                .from("user_profiles")
                .select("player_id")
                .in("player_id", playerIds.length ? playerIds : ["none"]);

            const linkedPlayerIds = new Set((linkedAccounts ?? []).map((u: any) => u.player_id));

            const [eventsRes, goalsRes] = await Promise.all([
                supabase.from("match_events").select("team_blue_ids, team_orange_ids, player_of_match_id").eq("status", "completed"),
                supabase.from("goals").select("scorer_id, assister_id").in("scorer_id", playerIds.length ? playerIds : ["none"]),
            ]);
            setPlayers((ps ?? []).map((p) => ({ ...p, communityNames: [], hasLinkedAccount: linkedPlayerIds.has(p.id) })));
            setStats(computeStats(playerIds, eventsRes.data ?? [], goalsRes.data ?? []));

        } else {
            // Specific community — only show if user is a member of it
            if (!superAdmin && !myCommunities.includes(tab)) {
                setPlayers([]);
                setStats({});
                setLoading(false);
                return;
            }
            const { data: members } = await supabase
                .from("community_members")
                .select("player_id, player:players(*)")
                .eq("community_id", tab);

            const communityPlayers = (members ?? []).map((m: any) => m.player).filter(Boolean);
            const playerIds = communityPlayers.map((p: any) => p.id);

            // Fetch linked user accounts
            const { data: linkedAccounts } = await supabase
                .from("user_profiles")
                .select("player_id")
                .in("player_id", playerIds.length ? playerIds : ["none"]);

            const linkedPlayerIds = new Set((linkedAccounts ?? []).map((u: any) => u.player_id));

            const [eventsRes, goalsRes] = await Promise.all([
                supabase.from("match_events")
                    .select("team_blue_ids, team_orange_ids, player_of_match_id")
                    .eq("community_id", tab).eq("status", "completed"),
                supabase.from("goals")
                    .select("scorer_id, assister_id, match_events!inner(community_id)")
                    .eq("match_events.community_id", tab),
            ]);
            setPlayers(communityPlayers.map((p: any) => ({ ...p, communityNames: [], hasLinkedAccount: linkedPlayerIds.has(p.id) })));
            setStats(computeStats(playerIds, eventsRes.data ?? [], goalsRes.data ?? []));
        }
        setLoading(false);
    };

    useEffect(() => {
        async function init() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: profile } = await supabase
                .from("user_profiles").select("player_id, role").eq("id", user.id).single();
            setMyPlayerId(profile?.player_id ?? null);

            const superAdmin = profile?.role === "super_admin";

            // Fetch communities the user belongs to
            let myComms: string[] = [];
            if (profile?.player_id) {
                const { data: memberships } = await supabase
                    .from("community_members").select("community_id").eq("player_id", profile.player_id);
                myComms = (memberships ?? []).map((m) => m.community_id);
                setMyCommunityIds(myComms);
            }

            // Load all communities for tabs (super admin sees all; others see only their own)
            const { data: allComms } = await supabase
                .from("communities").select("id, name").eq("is_active", true).order("name");
            const visibleComms = superAdmin
                ? (allComms ?? [])
                : (allComms ?? []).filter((c) => myComms.includes(c.id));
            setCommunities(visibleComms as any);

            // Set default tab
            const defaultTab = superAdmin ? "all" : (myComms[0] ?? "global");
            setSelectedTab(defaultTab);
            await loadData(defaultTab, superAdmin, myComms);
        }
        init();
    }, []);

    const handleTabChange = async (tab: "all" | "global" | string) => {
        setSelectedTab(tab);
        await loadData(tab, isSuperAdmin, myCommunityIds);
    };

    const handleSave = async (data: Partial<Player>, communityIds: string[] = []) => {
        let targetPlayerId: string;
        if (editingPlayer) {
            await supabase.from("players").update(data).eq("id", editingPlayer.id);
            targetPlayerId = editingPlayer.id;
        } else {
            const { data: inserted } = await supabase.from("players").insert(data).select("id").single();
            targetPlayerId = (inserted as any)?.id;
        }
        if (targetPlayerId && communityIds.length > 0) {
            await Promise.all(communityIds.map((cid) =>
                supabase.from("community_members").insert({
                    community_id: cid,
                    player_id: targetPlayerId,
                    role: "player",
                    rating: (data as any).rating ?? 3,
                    position_bias: (data as any).position_bias ?? 3,
                    is_goalkeeper: (data as any).is_goalkeeper ?? false,
                    gk_rating: (data as any).gk_rating ?? null,
                    outfield_rating: (data as any).outfield_rating ?? null,
                })
            ));
        }
        await loadData(selectedTab, isSuperAdmin, myCommunityIds);
        setShowForm(false);
        setEditingPlayer(undefined);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this player?")) return;
        await supabase.from("players").delete().eq("id", id);
        await loadData(selectedTab, isSuperAdmin, myCommunityIds);
    };

    const handleFormChange = async (playerId: string, form: FormRating) => {
        setPlayers((prev) => prev.map((p) => p.id === playerId ? { ...p, form_rating: form } : p));
        await supabase.from("players").update({ form_rating: form }).eq("id", playerId);
    };

    const handleLinkUser = async (userId: string | null) => {
        if (!linkingPlayer) return;
        await supabase.from("players").update({ user_id: userId }).eq("id", linkingPlayer.id);
        if (userId) {
            await supabase.from("user_profiles").update({ player_id: linkingPlayer.id }).eq("id", userId);
        }
        await loadData(selectedTab, isSuperAdmin, myCommunityIds);
    };

    const filtered = (() => {
        const list = players.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
        return list.sort((a, b) => {
            const sa = stats[a.id] ?? { games: 0, goals: 0, assists: 0, potm: 0 };
            const sb = stats[b.id] ?? { games: 0, goals: 0, assists: 0, potm: 0 };
            switch (sortBy) {
                case "name-asc":  return a.name.localeCompare(b.name);
                case "name-desc": return b.name.localeCompare(a.name);
                case "games-desc": return sb.games - sa.games;
                case "games-asc":  return sa.games - sb.games;
                case "goals-desc": return sb.goals - sa.goals;
                case "goals-asc":  return sa.goals - sb.goals;
                case "assists-desc": return sb.assists - sa.assists;
                case "assists-asc":  return sa.assists - sb.assists;
                case "potm-desc": return sb.potm - sa.potm;
                case "potm-asc":  return sa.potm - sb.potm;
                case "rating-desc": return (b.rating ?? 0) - (a.rating ?? 0);
                case "rating-asc":  return (a.rating ?? 0) - (b.rating ?? 0);
                default: return 0;
            }
        });
    })();
    const currentCommunityName = communities.find((c) => c.id === selectedTab)?.name;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-primary">Players</h1>
                    <p className="text-sm text-tertiary mt-1">
                        {selectedTab === "all"
                            ? `${players.length} total players`
                            : selectedTab === "global"
                            ? `${players.length} in global directory`
                            : `${players.length} in ${currentCommunityName ?? "community"}`}
                    </p>
                </div>
                {isAdmin && (
                    <button onClick={() => { setEditingPlayer(undefined); setShowForm(true); }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-brand-solid hover:bg-brand-solid_hover text-white text-sm font-semibold rounded-lg transition duration-100 ease-linear">
                        <Plus className="size-4" /> Add Player
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-secondary rounded-lg p-1 w-fit max-w-full overflow-x-auto">
                {/* Super admin: "All Players" tab showing everyone */}
                {isSuperAdmin && (
                    <button onClick={() => handleTabChange("all")}
                        className={cx(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition duration-100 ease-linear",
                            selectedTab === "all" ? "bg-primary text-primary shadow-sm" : "text-tertiary hover:text-secondary",
                        )}>
                        <Star01 className="size-3.5" /> All Players
                    </button>
                )}
                {/* Community tabs — visible to members of those communities */}
                {communities.map((c) => (
                    <button key={c.id} onClick={() => handleTabChange(c.id)}
                        className={cx(
                            "px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition duration-100 ease-linear",
                            selectedTab === c.id ? "bg-primary text-primary shadow-sm" : "text-tertiary hover:text-secondary",
                        )}>
                        {c.name}
                    </button>
                ))}
                {/* Global directory — opted-in players only; hidden from super admins who already see everyone */}
                {!isSuperAdmin && (
                    <button onClick={() => handleTabChange("global")}
                        className={cx(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition duration-100 ease-linear",
                            selectedTab === "global" ? "bg-primary text-primary shadow-sm" : "text-tertiary hover:text-secondary",
                        )}>
                        <Globe01 className="size-3.5" /> Global
                    </button>
                )}
            </div>

            {/* Info banners */}
            {selectedTab === "global" && (
                <div className="flex items-start gap-2.5 bg-secondary rounded-xl p-4">
                    <Globe01 className="size-4 text-tertiary flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-tertiary">
                        Only players who have opted in appear here. Stats are totals across all communities.
                        {" "}You can opt in by editing your player profile.
                    </p>
                </div>
            )}
            {selectedTab === "all" && isSuperAdmin && (
                <div className="flex items-start gap-2.5 bg-secondary rounded-xl p-4">
                    <Star01 className="size-4 text-tertiary flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-tertiary">Showing all players across every community. Community badges show which groups each player belongs to.</p>
                </div>
            )}

            {/* Search + Sort */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <SearchSm className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-quaternary" />
                    <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search players..."
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-primary bg-primary text-primary text-sm placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-brand transition duration-100 ease-linear" />
                </div>
                <div className="relative">
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="h-full pl-3 pr-8 py-2.5 rounded-lg border border-primary bg-primary text-primary text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-brand transition duration-100 ease-linear cursor-pointer"
                    >
                        <optgroup label="Name">
                            <option value="name-asc">A → Z</option>
                            <option value="name-desc">Z → A</option>
                        </optgroup>
                        <optgroup label="Games">
                            <option value="games-desc">Most Games</option>
                            <option value="games-asc">Least Games</option>
                        </optgroup>
                        <optgroup label="Goals">
                            <option value="goals-desc">Most Goals</option>
                            <option value="goals-asc">Least Goals</option>
                        </optgroup>
                        <optgroup label="Assists">
                            <option value="assists-desc">Most Assists</option>
                            <option value="assists-asc">Least Assists</option>
                        </optgroup>
                        <optgroup label="POTM">
                            <option value="potm-desc">Most POTM</option>
                            <option value="potm-asc">Least POTM</option>
                        </optgroup>
                        {isAdmin && (
                            <optgroup label="Rating">
                                <option value="rating-desc">Rating Hi → Lo</option>
                                <option value="rating-asc">Rating Lo → Hi</option>
                            </optgroup>
                        )}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-quaternary pointer-events-none" />
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-48">
                    <div className="size-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16">
                    <User01 className="size-10 mx-auto mb-3 text-quaternary" />
                    <p className="text-sm text-tertiary">
                        {selectedTab === "global" ? "No players have opted into the global directory yet." : "No players found."}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {filtered.map((player) => (
                        <PlayerCard
                            key={player.id}
                            player={player}
                            stats={stats[player.id] ?? { games: 0, goals: 0, assists: 0, potm: 0 }}
                            isAdmin={isAdmin}
                            isPublic={(player as any).is_public ?? false}
                            communityNames={player.communityNames ?? []}
                            showCommunities={selectedTab === "all" && isSuperAdmin}
                            hasLinkedAccount={(player as any).hasLinkedAccount}
                            onEdit={() => { setEditingPlayer(player); setShowForm(true); }}
                            onDelete={() => handleDelete(player.id)}
                            onLink={() => setLinkingPlayer(player)}
                            onFormChange={(form) => handleFormChange(player.id, form)}
                        />
                    ))}
                </div>
            )}

            {showForm && (
                <PlayerFormModal
                    player={editingPlayer}
                    isAdmin={isAdmin}
                    communities={isSuperAdmin
                        ? communities
                        : communities.filter((c) => adminCommunityIds.includes(c.id))
                    }
                    onSave={handleSave}
                    onClose={() => { setShowForm(false); setEditingPlayer(undefined); }}
                />
            )}
            {linkingPlayer && (
                <LinkUserModal player={linkingPlayer} onSave={handleLinkUser} onClose={() => setLinkingPlayer(null)} />
            )}
        </div>
    );
}
