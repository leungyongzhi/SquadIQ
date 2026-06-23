"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useViewMode } from "@/app/(app)/layout";
import type { Community } from "@/lib/football/types";
import { Plus, Users01, ChevronRight, Shield01 } from "@untitledui/icons";
import { cx } from "@/utils/cx";

function CommunityFormModal({ onSave, onClose }: {
    onSave: (data: Partial<Community>) => Promise<string | null>;
    onClose: () => void;
}) {
    const [form, setForm] = useState({
        name: "",
        description: "",
        default_payment_link: "",
        default_payment_amount: "",
        default_payment_message: "",
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        const err = await onSave({
            ...form,
            default_payment_amount: form.default_payment_amount ? +form.default_payment_amount : undefined,
        });
        if (err) setError(err);
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-overlay" onClick={onClose} />
            <div className="relative bg-primary rounded-2xl border border-secondary shadow-xl w-full max-w-md">
                <div className="p-6">
                    <h2 className="text-lg font-semibold text-primary mb-5">New Community</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-secondary mb-1.5">Name</label>
                            <input type="text" value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                placeholder="e.g. Wednesday Warriors"
                                className="w-full px-3.5 py-2.5 rounded-lg border border-primary bg-primary text-primary text-sm placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-brand transition duration-100 ease-linear"
                                required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-secondary mb-1.5">Description</label>
                            <textarea value={form.description}
                                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                                placeholder="Brief description of your community"
                                rows={2}
                                className="w-full px-3.5 py-2.5 rounded-lg border border-primary bg-primary text-primary text-sm placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-brand transition duration-100 ease-linear resize-none" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-secondary mb-1.5">Default Payment Link</label>
                                <input type="url" value={form.default_payment_link}
                                    onChange={(e) => setForm((f) => ({ ...f, default_payment_link: e.target.value }))}
                                    placeholder="https://monzo.me/..."
                                    className="w-full px-3.5 py-2.5 rounded-lg border border-primary bg-primary text-primary text-sm placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-brand transition duration-100 ease-linear" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-secondary mb-1.5">Amount (£)</label>
                                <input type="number" min={0} step={0.5} value={form.default_payment_amount}
                                    onChange={(e) => setForm((f) => ({ ...f, default_payment_amount: e.target.value }))}
                                    placeholder="5.00"
                                    className="w-full px-3.5 py-2.5 rounded-lg border border-primary bg-primary text-primary text-sm placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-brand transition duration-100 ease-linear" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-secondary mb-1.5">Default Payment Message</label>
                            <input type="text" value={form.default_payment_message}
                                onChange={(e) => setForm((f) => ({ ...f, default_payment_message: e.target.value }))}
                                placeholder="e.g. Please pay before matchday"
                                className="w-full px-3.5 py-2.5 rounded-lg border border-primary bg-primary text-primary text-sm placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-brand transition duration-100 ease-linear" />
                        </div>
                        {error && (
                            <p className="text-sm text-error-primary bg-error-primary rounded-lg px-3 py-2">{error}</p>
                        )}
                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={onClose} className="flex-1 py-2.5 px-4 border border-primary text-sm font-semibold text-secondary rounded-lg hover:bg-primary_hover transition duration-100 ease-linear">
                                Cancel
                            </button>
                            <button type="submit" disabled={saving} className="flex-1 py-2.5 px-4 bg-brand-solid hover:bg-brand-solid_hover text-white text-sm font-semibold rounded-lg transition duration-100 ease-linear disabled:opacity-50">
                                {saving ? "Creating..." : "Create"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default function CommunitiesPage() {
    const { isAdmin, isSuperAdmin, adminCommunityIds } = useViewMode();
    const [communities, setCommunities] = useState<Community[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
    const supabase = createClient();

    const load = async () => {
        const { data: allComms } = await supabase
            .from("communities").select("*").eq("is_active", true).order("created_at", { ascending: false });

        // Super admin sees all; regular admins/players only see their own communities
        let comms = allComms ?? [];
        if (!isSuperAdmin && comms.length > 0) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase
                    .from("user_profiles").select("player_id").eq("id", user.id).single();
                if (profile?.player_id) {
                    const { data: memberships } = await supabase
                        .from("community_members")
                        .select("community_id")
                        .eq("player_id", profile.player_id);
                    const myIds = new Set((memberships ?? []).map((m) => m.community_id));
                    comms = comms.filter((c) => myIds.has(c.id));
                } else {
                    comms = [];
                }
            }
        }
        setCommunities(comms);

        if (comms?.length) {
            const { data: counts } = await supabase
                .from("community_members")
                .select("community_id")
                .in("community_id", comms.map((c) => c.id));
            const map: Record<string, number> = {};
            (counts ?? []).forEach((r) => { map[r.community_id] = (map[r.community_id] ?? 0) + 1; });
            setMemberCounts(map);
        }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const handleCreate = async (data: Partial<Community>): Promise<string | null> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return "Not logged in.";

        const { data: newComm, error } = await supabase
            .from("communities")
            .insert({ ...data, created_by: user.id })
            .select("id")
            .single();

        if (error) {
            if (error.code === "23505") return `A community named "${data.name}" already exists.`;
            return error.message;
        }

        // Auto-add creator as community admin
        if (newComm?.id) {
            const { data: profile } = await supabase
                .from("user_profiles").select("player_id").eq("id", user.id).single();
            if (profile?.player_id) {
                await supabase.from("community_members").insert({
                    community_id: newComm.id,
                    player_id: profile.player_id,
                    role: "admin",
                    rating: 3,
                    position_bias: 3,
                });
            }
        }
        await load();
        setShowForm(false);
        return null;
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-primary">Communities</h1>
                    <p className="text-sm text-tertiary mt-1">{communities.length} active {communities.length === 1 ? "community" : "communities"}</p>
                </div>
                <button onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-brand-solid hover:bg-brand-solid_hover text-white text-sm font-semibold rounded-lg transition duration-100 ease-linear">
                    <Plus className="size-4" />
                    New Community
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-48">
                    <div className="size-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                </div>
            ) : communities.length === 0 ? (
                <div className="text-center py-16 text-tertiary">
                    <Shield01 className="size-10 mx-auto mb-3 text-quaternary" />
                    <p className="text-sm font-medium text-secondary">No communities yet</p>
                    {isAdmin && <p className="text-xs mt-1">Create the first one to get started.</p>}
                </div>
            ) : (
                <div className="space-y-3">
                    {communities.map((c) => {
                        const canManage = isSuperAdmin || adminCommunityIds.includes(c.id);
                        return (
                        <Link key={c.id} href={`/communities/${c.id}`}
                            className="flex items-center gap-4 bg-primary rounded-xl border border-secondary p-4 hover:border-brand hover:shadow-sm transition duration-100 ease-linear">
                            <div className="flex size-12 items-center justify-center rounded-xl bg-brand-secondary flex-shrink-0">
                                <Shield01 className="size-5 text-brand-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-semibold text-primary truncate">{c.name}</p>
                                    {canManage && (
                                        <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-brand-secondary text-brand-primary flex-shrink-0">
                                            {isSuperAdmin ? "Super Admin" : "Admin"}
                                        </span>
                                    )}
                                </div>
                                {c.description && <p className="text-xs text-tertiary mt-0.5 truncate">{c.description}</p>}
                                <div className="flex items-center gap-1.5 mt-1 text-xs text-quaternary">
                                    <Users01 className="size-3.5" />
                                    {memberCounts[c.id] ?? 0} {memberCounts[c.id] === 1 ? "member" : "members"}
                                    {c.default_payment_amount && (
                                        <span className="ml-2">· £{c.default_payment_amount} per game</span>
                                    )}
                                </div>
                            </div>
                            <ChevronRight className="size-5 text-quaternary flex-shrink-0" />
                        </Link>
                        );
                    })}
                </div>
            )}

            {showForm && <CommunityFormModal onSave={handleCreate} onClose={() => setShowForm(false)} />}
        </div>
    );
}
