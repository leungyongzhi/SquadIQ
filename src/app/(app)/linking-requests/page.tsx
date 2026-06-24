"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useViewMode } from "@/app/(app)/layout";
import { CheckCircle, XCircle, Clock, User01 } from "@untitledui/icons";

interface LinkingRequest {
    id: string;
    created_at: string;
    user_id: string;
    player_id: string | null;
    request_type: "link_existing" | "create_new";
    player_name: string | null;
    community_id: string;
    status: "pending" | "approved" | "rejected";
    rejection_reason: string | null;
    user?: { full_name: string };
    player?: { name: string };
    community?: { name: string };
}

export default function LinkingRequestsPage() {
    const { isAdmin, isSuperAdmin } = useViewMode();
    const [requests, setRequests] = useState<LinkingRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<"pending" | "all">("pending");
    const supabase = createClient();

    useEffect(() => {
        if (!isAdmin && !isSuperAdmin) {
            return;
        }
        loadRequests();
    }, [isAdmin, isSuperAdmin]);

    const loadRequests = async () => {
        try {
            let query = supabase
                .from("linking_requests")
                .select(`
                    *,
                    player:player_id(name),
                    community:community_id(name)
                `);

            if (filter === "pending") {
                query = query.eq("status", "pending");
            }

            const { data: requests, error } = await query.order("created_at", { ascending: false });

            if (error) {
                console.error("Error loading requests:", error);
                alert(`Error: ${error.message}`);
                setRequests([]);
            } else {
                // Fetch user profiles separately to get full names
                if (requests && requests.length > 0) {
                    const userIds = requests.map((r: any) => r.user_id);
                    const { data: profiles } = await supabase
                        .from("user_profiles")
                        .select("id, full_name")
                        .in("id", userIds);

                    const profileMap = Object.fromEntries(
                        (profiles ?? []).map((p: any) => [p.id, p.full_name])
                    );

                    const enriched = requests.map((r: any) => ({
                        ...r,
                        user: { full_name: profileMap[r.user_id] || "Unknown User" },
                    }));

                    setRequests(enriched);
                } else {
                    setRequests([]);
                }
            }
        } catch (err) {
            console.error("Exception loading requests:", err);
        }
        setLoading(false);
    };

    const approveRequest = async (request: LinkingRequest) => {
        let playerId = request.player_id;

        // If creating new player, create it first
        if (request.request_type === "create_new" && !playerId) {
            const { data: newPlayer, error: createError } = await supabase
                .from("players")
                .insert({
                    name: request.player_name,
                    is_active: true,
                    rating: 3,
                    position_bias: 3,
                    is_goalkeeper: false,
                })
                .select()
                .single();

            if (createError) {
                alert(`Error creating player: ${createError.message}`);
                return;
            }
            playerId = newPlayer.id;
        }

        // Check if the player being linked to has admin role in any community
        const { data: adminMemberships } = await supabase
            .from("community_members")
            .select("role")
            .eq("player_id", playerId)
            .eq("role", "admin")
            .limit(1);

        const isAdmin = (adminMemberships ?? []).length > 0;

        // Link user to player and update role if admin
        const { error: linkError } = await supabase
            .from("user_profiles")
            .update({
                player_id: playerId,
                role: isAdmin ? "admin" : "player"
            })
            .eq("id", request.user_id);

        if (linkError) {
            alert(`Error linking player: ${linkError.message}`);
            return;
        }

        // Update request status
        const { error: updateError } = await supabase
            .from("linking_requests")
            .update({
                status: "approved",
                reviewed_at: new Date().toISOString(),
            })
            .eq("id", request.id);

        if (updateError) {
            alert(`Error updating request: ${updateError.message}`);
            return;
        }

        // Reload requests
        await loadRequests();
    };

    const rejectRequest = async (request: LinkingRequest, reason: string) => {
        const { error } = await supabase
            .from("linking_requests")
            .update({
                status: "rejected",
                rejection_reason: reason,
                reviewed_at: new Date().toISOString(),
            })
            .eq("id", request.id);

        if (error) {
            alert(`Error rejecting request: ${error.message}`);
            return;
        }

        await loadRequests();
    };

    if (!isAdmin && !isSuperAdmin) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-tertiary">You don't have permission to view this page</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-600" />
            </div>
        );
    }

    const pendingCount = requests.filter((r) => r.status === "pending").length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-semibold text-primary">Linking Requests</h1>
                <p className="text-sm text-tertiary mt-1">Review and approve player account linking requests</p>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 bg-secondary rounded-lg p-1 w-fit">
                <button
                    onClick={() => {
                        setFilter("pending");
                        setRequests(requests.filter((r) => r.status === "pending"));
                    }}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                        filter === "pending"
                            ? "bg-primary text-primary shadow-sm"
                            : "text-tertiary hover:text-secondary"
                    }`}
                >
                    Pending {pendingCount > 0 && `(${pendingCount})`}
                </button>
                <button
                    onClick={() => {
                        setFilter("all");
                        loadRequests();
                    }}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                        filter === "all"
                            ? "bg-primary text-primary shadow-sm"
                            : "text-tertiary hover:text-secondary"
                    }`}
                >
                    All Requests
                </button>
            </div>

            {/* Requests List */}
            {requests.length === 0 ? (
                <div className="bg-primary rounded-2xl border border-secondary p-12 text-center">
                    <Clock className="size-12 text-tertiary mx-auto mb-4" />
                    <p className="text-tertiary">
                        {filter === "pending" ? "No pending requests" : "No requests"}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {requests.map((request) => (
                        <RequestCard
                            key={request.id}
                            request={request}
                            onApprove={() => approveRequest(request)}
                            onReject={(reason) => rejectRequest(request, reason)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function RequestCard({
    request,
    onApprove,
    onReject,
}: {
    request: LinkingRequest;
    onApprove: () => Promise<void>;
    onReject: (reason: string) => Promise<void>;
}) {
    const [rejecting, setRejecting] = useState(false);
    const [rejectionReason, setRejectionReason] = useState("");

    const statusColors = {
        pending: "bg-warning-secondary text-warning-primary",
        approved: "bg-success-secondary text-success-primary",
        rejected: "bg-error-secondary text-error-primary",
    };

    const statusIcons = {
        pending: Clock,
        approved: CheckCircle,
        rejected: XCircle,
    };

    const StatusIcon = statusIcons[request.status];

    return (
        <div className="bg-primary rounded-xl border border-secondary p-4">
            <div className="flex flex-col gap-4">
                <div className="flex items-start gap-4">
                    {/* Status Badge */}
                    <div className={`size-10 rounded-lg ${statusColors[request.status]} flex items-center justify-center flex-shrink-0`}>
                        <StatusIcon className="size-5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                            <p className="font-semibold text-primary">
                                {request.user?.full_name || "Unknown User"}
                            </p>
                            <p className="text-sm text-tertiary mt-1">
                                {request.request_type === "link_existing"
                                    ? `Requesting to link to: ${request.player?.name || "Unknown Player"}`
                                    : `Creating new profile: ${request.player_name || "No name provided"}`}
                            </p>
                            <p className="text-xs text-quaternary mt-1">
                                Community: {request.community?.name} • {new Date(request.created_at).toLocaleDateString()}
                            </p>
                        </div>

                        {/* Status Badge */}
                        <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${statusColors[request.status]}`}>
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </span>
                    </div>

                    {/* Actions for Pending */}
                    {request.status === "pending" && (
                        <div className="mt-4 flex gap-2">
                            <button
                                onClick={onApprove}
                                className="px-3 py-2 bg-success-primary hover:opacity-90 text-white text-sm font-semibold rounded-lg transition"
                            >
                                Approve
                            </button>
                            <button
                                onClick={() => setRejecting(!rejecting)}
                                className="px-3 py-2 bg-error-primary hover:opacity-90 text-white text-sm font-semibold rounded-lg transition"
                            >
                                Reject
                            </button>
                        </div>
                    )}

                    {/* Rejection Reason Form */}
                    {rejecting && (
                        <div className="mt-4 space-y-2">
                            <textarea
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="Reason for rejection (optional)"
                                className="w-full px-3 py-2 rounded-lg border border-primary bg-primary text-primary text-sm placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-brand resize-none"
                                rows={2}
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        onReject(rejectionReason);
                                        setRejecting(false);
                                    }}
                                    className="flex-1 px-3 py-2 bg-error-primary hover:opacity-90 text-white text-sm font-semibold rounded-lg transition"
                                >
                                    Confirm Rejection
                                </button>
                                <button
                                    onClick={() => {
                                        setRejecting(false);
                                        setRejectionReason("");
                                    }}
                                    className="px-3 py-2 bg-secondary hover:bg-secondary_hover text-primary text-sm font-semibold rounded-lg transition"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Rejection Reason Display */}
                    {request.status === "rejected" && request.rejection_reason && (
                        <p className="mt-2 text-sm text-error-primary">Reason: {request.rejection_reason}</p>
                    )}
                    </div>
                </div>
            </div>
        </div>
    );
}
