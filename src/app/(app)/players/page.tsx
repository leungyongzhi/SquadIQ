"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Player } from "@/lib/football/types";
import {
    Plus,
    Edit02,
    Trash01,
    SearchSm,
    Shield01,
    Zap,
    Lightning01,
    Link01,
    User01,
    Upload01,
} from "@untitledui/icons";
import { cx } from "@/utils/cx";

// Position label/icon based on bias 1-5
function positionInfo(bias: number) {
    if (bias === 1) return { label: "DEF", icon: Shield01, color: "text-blue-600 dark:text-blue-400" };
    if (bias === 2) return { label: "DEF+", icon: Shield01, color: "text-blue-500 dark:text-blue-300" };
    if (bias === 3) return { label: "BAL", icon: Zap, color: "text-brand-secondary" };
    if (bias === 4) return { label: "ATK+", icon: Zap, color: "text-orange-500 dark:text-orange-400" };
    return { label: "ATK", icon: Lightning01, color: "text-orange-600 dark:text-orange-300" };
}

interface PlayerFormData {
    name: string;
    rating: number;
    position_bias: number;
    is_goalkeeper: boolean;
    gk_rating: number;
    outfield_rating: number;
    is_active: boolean;
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
    avatar_url: "",
};

function PlayerFormModal({
    player,
    isAdmin,
    onSave,
    onClose,
}: {
    player?: Player;
    isAdmin: boolean;
    onSave: (data: Partial<Player>) => Promise<void>;
    onClose: () => void;
}) {
    const [form, setForm] = useState<PlayerFormData>(
        player
            ? {
                  name: player.name,
                  rating: player.rating,
                  position_bias: player.position_bias,
                  is_goalkeeper: player.is_goalkeeper,
                  gk_rating: player.gk_rating ?? 3,
                  outfield_rating: player.outfield_rating ?? 3,
                  is_active: player.is_active,
                  avatar_url: player.avatar_url ?? "",
              }
            : DEFAULT_FORM,
    );
    const [saving, setSaving] = useState(false);
    const supabase = createClient();
    const fileRef = useRef<HTMLInputElement>(null);

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const ext = file.name.split(".").pop();
        const path = `avatars/${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("football-assets").upload(path, file, { upsert: true });
        if (!error) {
            const { data } = supabase.storage.from("football-assets").getPublicUrl(path);
            setForm((f) => ({ ...f, avatar_url: data.publicUrl }));
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
            avatar_url: form.avatar_url || null,
            ...(isAdmin && {
                rating: form.rating,
                gk_rating: form.is_goalkeeper ? form.gk_rating : null,
                outfield_rating: form.is_goalkeeper ? form.outfield_rating : null,
            }),
        };
        await onSave(payload);
        setSaving(false);
    };

    const biasLabels = ["DEF", "DEF+", "BAL", "ATK+", "ATK"];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-overlay" onClick={onClose} />
            <div className="relative bg-primary rounded-2xl border border-secondary shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <h2 className="text-lg font-semibold text-primary mb-5">
                        {player ? "Edit Player" : "Add Player"}
                    </h2>
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
                                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                                <button
                                    type="button"
                                    onClick={() => fileRef.current?.click()}
                                    className="flex items-center gap-1.5 text-sm text-brand-secondary hover:text-brand-secondary_hover transition duration-100 ease-linear"
                                >
                                    <Upload01 className="size-4" />
                                    Upload photo
                                </button>
                                <p className="text-xs text-tertiary mt-0.5">Gender-neutral silhouette shown if no photo</p>
                            </div>
                        </div>

                        {/* Name */}
                        <div>
                            <label className="block text-sm font-medium text-secondary mb-1.5">Name</label>
                            <input
                                type="text"
                                value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                placeholder="Player name"
                                className="w-full px-3.5 py-2.5 rounded-lg border border-primary bg-primary text-primary text-sm placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition duration-100 ease-linear"
                                required
                            />
                        </div>

                        {/* Rating — admin only */}
                        {isAdmin && !form.is_goalkeeper && (
                            <div>
                                <label className="block text-sm font-medium text-secondary mb-1.5">
                                    Rating <span className="text-xs text-tertiary">(admin only)</span>
                                </label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="range"
                                        min={1}
                                        max={6}
                                        value={form.rating}
                                        onChange={(e) => setForm((f) => ({ ...f, rating: +e.target.value }))}
                                        className="flex-1 accent-brand-600"
                                    />
                                    <span className="text-sm font-semibold text-primary w-4 text-center">{form.rating}</span>
                                </div>
                            </div>
                        )}

                        {/* Position bias */}
                        <div>
                            <label className="block text-sm font-medium text-secondary mb-1.5">Position</label>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                                    <Shield01 className="size-3.5" />
                                    DEF
                                </div>
                                <input
                                    type="range"
                                    min={1}
                                    max={5}
                                    value={form.position_bias}
                                    onChange={(e) => setForm((f) => ({ ...f, position_bias: +e.target.value }))}
                                    className="flex-1 accent-brand-600"
                                />
                                <div className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
                                    ATK
                                    <Lightning01 className="size-3.5" />
                                </div>
                            </div>
                            <p className="text-xs text-center text-tertiary mt-1">{biasLabels[form.position_bias - 1]}</p>
                        </div>

                        {/* GK toggle */}
                        <div className="flex items-center justify-between p-3 rounded-lg border border-secondary">
                            <div>
                                <p className="text-sm font-medium text-primary">Can play Goalkeeper</p>
                                <p className="text-xs text-tertiary">Enable GK ratings</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setForm((f) => ({ ...f, is_goalkeeper: !f.is_goalkeeper }))}
                                className={cx(
                                    "relative inline-flex h-6 w-11 items-center rounded-full transition duration-100 ease-linear",
                                    form.is_goalkeeper ? "bg-brand-solid" : "bg-tertiary",
                                )}
                            >
                                <span
                                    className={cx(
                                        "inline-block size-4 rounded-full bg-white shadow transition duration-100 ease-linear",
                                        form.is_goalkeeper ? "translate-x-6" : "translate-x-1",
                                    )}
                                />
                            </button>
                        </div>

                        {/* GK ratings — admin only */}
                        {isAdmin && form.is_goalkeeper && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-secondary mb-1.5">
                                        GK Rating <span className="text-xs text-warning-primary">(goalkeeper)</span>
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="range"
                                            min={1}
                                            max={6}
                                            value={form.gk_rating}
                                            onChange={(e) => setForm((f) => ({ ...f, gk_rating: +e.target.value }))}
                                            className="flex-1 accent-yellow-500"
                                        />
                                        <span className="text-sm font-semibold text-warning-primary w-4 text-center">{form.gk_rating}</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-secondary mb-1.5">
                                        Outfield Rating <span className="text-xs text-tertiary">(when not in goal)</span>
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="range"
                                            min={1}
                                            max={6}
                                            value={form.outfield_rating}
                                            onChange={(e) => setForm((f) => ({ ...f, outfield_rating: +e.target.value }))}
                                            className="flex-1 accent-brand-600"
                                        />
                                        <span className="text-sm font-semibold text-primary w-4 text-center">{form.outfield_rating}</span>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Active */}
                        <div className="flex items-center justify-between p-3 rounded-lg border border-secondary">
                            <p className="text-sm font-medium text-primary">Active player</p>
                            <button
                                type="button"
                                onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
                                className={cx(
                                    "relative inline-flex h-6 w-11 items-center rounded-full transition duration-100 ease-linear",
                                    form.is_active ? "bg-brand-solid" : "bg-tertiary",
                                )}
                            >
                                <span
                                    className={cx(
                                        "inline-block size-4 rounded-full bg-white shadow transition duration-100 ease-linear",
                                        form.is_active ? "translate-x-6" : "translate-x-1",
                                    )}
                                />
                            </button>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 py-2.5 px-4 border border-primary text-sm font-semibold text-secondary rounded-lg hover:bg-primary_hover transition duration-100 ease-linear"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex-1 py-2.5 px-4 bg-brand-solid hover:bg-brand-solid_hover text-white text-sm font-semibold rounded-lg transition duration-100 ease-linear disabled:opacity-50"
                            >
                                {saving ? "Saving..." : "Save"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

function LinkUserModal({
    player,
    onSave,
    onClose,
}: {
    player: Player;
    onSave: (userId: string | null) => Promise<void>;
    onClose: () => void;
}) {
    const [users, setUsers] = useState<{ id: string; full_name: string; role: string }[]>([]);
    const [search, setSearch] = useState("");
    const [saving, setSaving] = useState(false);
    const supabase = createClient();

    useEffect(() => {
        supabase
            .from("user_profiles")
            .select("id, full_name, role")
            .then(({ data }) => setUsers(data ?? []));
    }, []);

    const filtered = users.filter(
        (u) =>
            u.full_name?.toLowerCase().includes(search.toLowerCase()),
    );

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
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search users..."
                            className="w-full pl-9 pr-3.5 py-2 rounded-lg border border-primary bg-primary text-primary text-sm placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-brand transition duration-100 ease-linear"
                        />
                    </div>

                    <div className="space-y-1 max-h-48 overflow-y-auto">
                        {player.user_id && (
                            <button
                                onClick={() => handleLink(null)}
                                disabled={saving}
                                className="w-full text-left px-3 py-2 rounded-lg text-sm text-error-primary hover:bg-error-primary transition duration-100 ease-linear"
                            >
                                Unlink current user
                            </button>
                        )}
                        {filtered.map((u) => (
                            <button
                                key={u.id}
                                onClick={() => handleLink(u.id)}
                                disabled={saving}
                                className={cx(
                                    "w-full text-left px-3 py-2 rounded-lg text-sm transition duration-100 ease-linear",
                                    u.id === player.user_id
                                        ? "bg-brand-primary_alt text-brand-primary"
                                        : "text-secondary hover:bg-primary_hover",
                                )}
                            >
                                <span className="font-medium">{u.full_name || "—"}</span>
                                <span className="text-tertiary ml-2 text-xs capitalize">{u.role}</span>
                                {u.id === player.user_id && <span className="text-xs text-brand-secondary ml-2">✓ Linked</span>}
                            </button>
                        ))}
                    </div>

                    <button onClick={onClose} className="w-full mt-4 py-2 text-sm text-tertiary hover:text-secondary transition duration-100 ease-linear">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function PlayersPage() {
    const [players, setPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [search, setSearch] = useState("");
    const [editingPlayer, setEditingPlayer] = useState<Player | undefined>();
    const [showForm, setShowForm] = useState(false);
    const [linkingPlayer, setLinkingPlayer] = useState<Player | null>(null);
    const supabase = createClient();

    const loadPlayers = async () => {
        const { data } = await supabase.from("players").select("*").order("name");
        setPlayers(data ?? []);
        setLoading(false);
    };

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (!user) return;
            supabase.from("user_profiles").select("role").eq("id", user.id).single().then(({ data }) => {
                setIsAdmin(data?.role === "admin");
            });
        });
        loadPlayers();
    }, []);

    const handleSave = async (data: Partial<Player>) => {
        if (editingPlayer) {
            await supabase.from("players").update(data).eq("id", editingPlayer.id);
        } else {
            await supabase.from("players").insert(data);
        }
        await loadPlayers();
        setShowForm(false);
        setEditingPlayer(undefined);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this player?")) return;
        await supabase.from("players").delete().eq("id", id);
        await loadPlayers();
    };

    const handleLinkUser = async (userId: string | null) => {
        if (!linkingPlayer) return;
        await supabase.from("players").update({ user_id: userId }).eq("id", linkingPlayer.id);
        // Also update user_profiles to set player_id
        if (userId) {
            await supabase.from("user_profiles").update({ player_id: linkingPlayer.id }).eq("id", userId);
        }
        await loadPlayers();
    };

    const filtered = players.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()),
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-primary">Players</h1>
                    <p className="text-sm text-tertiary mt-1">{players.filter((p) => p.is_active).length} active players</p>
                </div>
                {isAdmin && (
                    <button
                        onClick={() => { setEditingPlayer(undefined); setShowForm(true); }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-brand-solid hover:bg-brand-solid_hover text-white text-sm font-semibold rounded-lg transition duration-100 ease-linear"
                    >
                        <Plus className="size-4" />
                        Add Player
                    </button>
                )}
            </div>

            {/* Search */}
            <div className="relative">
                <SearchSm className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-quaternary" />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search players..."
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-primary bg-primary text-primary text-sm placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-brand transition duration-100 ease-linear"
                />
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-48">
                    <div className="size-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {filtered.map((player) => {
                        const pos = positionInfo(player.position_bias);
                        const PosIcon = pos.icon;
                        return (
                            <div
                                key={player.id}
                                className={cx(
                                    "bg-primary rounded-xl border border-secondary p-4 relative",
                                    !player.is_active && "opacity-60",
                                )}
                            >
                                {/* Avatar */}
                                <div className="flex items-start gap-3 mb-3">
                                    <div className="size-12 rounded-full bg-secondary border border-secondary overflow-hidden flex items-center justify-center flex-shrink-0">
                                        {player.avatar_url ? (
                                            <img src={player.avatar_url} alt={player.name} className="size-full object-cover" />
                                        ) : (
                                            <User01 className="size-6 text-quaternary" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-primary truncate">{player.name}</p>
                                        <div className="flex items-center gap-1 mt-0.5">
                                            <PosIcon className={cx("size-3.5", pos.color)} />
                                            <span className={cx("text-xs font-medium", pos.color)}>{pos.label}</span>
                                            {player.is_goalkeeper && (
                                                <span className="ml-1 text-xs font-medium text-warning-primary bg-warning-primary rounded px-1">GK</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Rating — admin only */}
                                {isAdmin && (
                                    <div className="flex gap-2 mb-3">
                                        {player.is_goalkeeper ? (
                                            <>
                                                <div className="flex-1 bg-warning-primary rounded-lg p-2 text-center">
                                                    <p className="text-xs text-warning-primary">GK</p>
                                                    <p className="text-lg font-bold text-warning-primary">{player.gk_rating ?? "—"}</p>
                                                </div>
                                                <div className="flex-1 bg-secondary rounded-lg p-2 text-center">
                                                    <p className="text-xs text-tertiary">Field</p>
                                                    <p className="text-lg font-bold text-primary">{player.outfield_rating ?? "—"}</p>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex-1 bg-secondary rounded-lg p-2 text-center">
                                                <p className="text-xs text-tertiary">Rating</p>
                                                <p className="text-2xl font-bold text-primary">{player.rating}</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Linked account */}
                                <div className="flex items-center gap-1.5 mb-3">
                                    <div className={cx("size-1.5 rounded-full", player.user_id ? "bg-success-solid" : "bg-quaternary")} />
                                    <span className="text-xs text-tertiary">
                                        {player.user_id ? "Account linked" : "No account linked"}
                                    </span>
                                </div>

                                {/* Actions — admin only */}
                                {isAdmin && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => { setLinkingPlayer(player); }}
                                            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-tertiary hover:text-primary border border-secondary hover:border-primary rounded-lg transition duration-100 ease-linear"
                                        >
                                            <Link01 className="size-3.5" />
                                            Link
                                        </button>
                                        <button
                                            onClick={() => { setEditingPlayer(player); setShowForm(true); }}
                                            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-tertiary hover:text-primary border border-secondary hover:border-primary rounded-lg transition duration-100 ease-linear"
                                        >
                                            <Edit02 className="size-3.5" />
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(player.id)}
                                            className="flex items-center justify-center p-1.5 text-error-primary hover:bg-error-primary rounded-lg border border-transparent hover:border-error transition duration-100 ease-linear"
                                        >
                                            <Trash01 className="size-3.5" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {showForm && (
                <PlayerFormModal
                    player={editingPlayer}
                    isAdmin={isAdmin}
                    onSave={handleSave}
                    onClose={() => { setShowForm(false); setEditingPlayer(undefined); }}
                />
            )}

            {linkingPlayer && (
                <LinkUserModal
                    player={linkingPlayer}
                    onSave={handleLinkUser}
                    onClose={() => setLinkingPlayer(null)}
                />
            )}
        </div>
    );
}
