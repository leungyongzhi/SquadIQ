"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Trophy01, Mail01, Lock01, Eye, EyeOff } from "@untitledui/icons";

export default function LoginPage() {
    const [mode, setMode] = useState<"login" | "signup">("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [fullName, setFullName] = useState("");
    const [intendedRole, setIntendedRole] = useState<"player" | "admin">("player");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const router = useRouter();
    const supabase = createClient();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            setError(error.message);
        } else {
            router.push("/");
        }
        setLoading(false);
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: fullName, intended_role: intendedRole },
            },
        });

        if (error) {
            setError(error.message);
            setLoading(false);
            return;
        }

        // If email confirmation is disabled, session is returned immediately
        if (data.session) {
            router.push("/");
            return;
        }

        // Email confirmation is enabled — show message
        setMessage("Check your email for a confirmation link, then come back and sign in.");
        setMode("login");
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-secondary flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="flex flex-col items-center mb-8">
                    <div className="flex size-14 items-center justify-center rounded-2xl bg-success-solid mb-4">
                        <Trophy01 className="size-7 text-white" />
                    </div>
                    <h1 className="text-2xl font-semibold text-primary">Football Manager</h1>
                    <p className="text-sm text-tertiary mt-1">
                        {mode === "login" ? "Sign in to your account" : "Create a new account"}
                    </p>
                </div>

                <div className="bg-primary rounded-2xl border border-secondary p-6 shadow-sm">
                    {message && (
                        <div className="mb-4 p-3 rounded-lg bg-brand-secondary border border-brand_alt">
                            <p className="text-sm text-brand-primary">{message}</p>
                        </div>
                    )}
                    {mode === "login" ? (
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-secondary mb-1.5">Email</label>
                                <div className="relative">
                                    <Mail01 className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-quaternary" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="you@example.com"
                                        className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-primary bg-primary text-primary text-sm placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition duration-100 ease-linear"
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-secondary mb-1.5">Password</label>
                                <div className="relative">
                                    <Lock01 className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-quaternary" />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-primary bg-primary text-primary text-sm placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition duration-100 ease-linear"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-quaternary hover:text-tertiary"
                                    >
                                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                    </button>
                                </div>
                            </div>
                            {error && <p className="text-sm text-error-primary">{error}</p>}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-2.5 px-4 bg-brand-solid hover:bg-brand-solid_hover text-white text-sm font-semibold rounded-lg transition duration-100 ease-linear disabled:opacity-50"
                            >
                                {loading ? "Signing in..." : "Sign In"}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleSignup} className="space-y-4">
                            {/* Role choice */}
                            <div>
                                <label className="block text-sm font-medium text-secondary mb-2">I am a...</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {(["player", "admin"] as const).map((role) => (
                                        <button
                                            key={role}
                                            type="button"
                                            onClick={() => setIntendedRole(role)}
                                            className={`py-2.5 px-3 rounded-lg border text-sm font-medium transition duration-100 ease-linear capitalize ${
                                                intendedRole === role
                                                    ? "border-brand bg-brand-primary_alt text-brand-primary"
                                                    : "border-primary text-secondary hover:bg-primary_hover"
                                            }`}
                                        >
                                            {role === "player" ? "⚽ Player" : "🛡️ Team Admin"}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-tertiary mt-1.5">Admin access requires approval from an existing admin.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-secondary mb-1.5">Full Name</label>
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="Your name"
                                    className="w-full px-3.5 py-2.5 rounded-lg border border-primary bg-primary text-primary text-sm placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition duration-100 ease-linear"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-secondary mb-1.5">Email</label>
                                <div className="relative">
                                    <Mail01 className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-quaternary" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="you@example.com"
                                        className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-primary bg-primary text-primary text-sm placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition duration-100 ease-linear"
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-secondary mb-1.5">Password</label>
                                <div className="relative">
                                    <Lock01 className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-quaternary" />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Min. 8 characters"
                                        className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-primary bg-primary text-primary text-sm placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition duration-100 ease-linear"
                                        required
                                        minLength={8}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-quaternary hover:text-tertiary"
                                    >
                                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                    </button>
                                </div>
                            </div>
                            {error && <p className="text-sm text-error-primary">{error}</p>}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-2.5 px-4 bg-brand-solid hover:bg-brand-solid_hover text-white text-sm font-semibold rounded-lg transition duration-100 ease-linear disabled:opacity-50"
                            >
                                {loading ? "Creating account..." : "Create Account"}
                            </button>
                        </form>
                    )}

                    <p className="text-sm text-center text-tertiary mt-4">
                            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
                            <button
                                onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
                                className="text-brand-secondary hover:text-brand-secondary_hover font-medium transition duration-100 ease-linear"
                            >
                                {mode === "login" ? "Sign up" : "Sign in"}
                            </button>
                        </p>
                </div>
            </div>
        </div>
    );
}
