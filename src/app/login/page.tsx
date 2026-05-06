"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { DJANGO_API_BASE } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { Lock, User, Target, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function LoginPage() {
  const { loginUser, user } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      router.push("/");
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${DJANGO_API_BASE}/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok) {
        await loginUser(data.access, data.refresh);
        router.push("/");
      } else {
        const errorMsg = typeof data === 'object' && Object.values(data)[0] 
          ? String((Object.values(data)[0] as any[])[0] || Object.values(data)[0]) 
          : "Authentication failed. Please check your credentials.";
        setError(data.detail || errorMsg);
      }
    } catch {
      setError("Network error. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center relative overflow-hidden">
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-[#00f0ff] rounded-full mix-blend-screen filter blur-[150px] opacity-20 animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-[#0a58ca] rounded-full mix-blend-screen filter blur-[150px] opacity-20 animate-pulse" style={{ animationDelay: "2s" }} />
      
      <div className="fixed inset-0 bg-[url('/noise.png')] opacity-[0.03] pointer-events-none mix-blend-overlay" />

      <div className="w-full max-w-md p-8 relative z-10">
        <div className="bg-[#161b22]/80 backdrop-blur-xl border border-white/10 p-10 rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.1)] relative overflow-hidden">
          
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00f0ff] to-transparent opacity-70" />

          <div className="flex justify-center items-center gap-4 mb-8 group cursor-pointer">
            <Image
              src="/quasar-logo.svg"
              alt="Quasar Studio"
              width={54}
              height={54}
              className="object-cover drop-shadow-[0_0_8px_rgba(0,240,255,0.6)] transition-all duration-700 group-hover:animate-[spin_2s_linear_infinite] flex-shrink-0"
              priority
            />
            <div className="flex flex-col justify-center overflow-hidden">
              <span
                className="text-[28px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-[#00f0ff] drop-shadow-[0_0_5px_rgba(0,240,255,0.3)] leading-none mb-0.5 tracking-wide"
                style={{ fontFamily: "'Eurostile', 'Michroma', sans-serif" }}
              >
                QUASAR
              </span>
              <span
                className="text-[14px] font-bold text-white/50 tracking-[0.2em] leading-none uppercase"
                style={{ fontFamily: "'Eurostile', 'Michroma', sans-serif" }}
              >
                Studio
              </span>
            </div>
          </div>

          <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60 text-center tracking-tight mb-2">
            Welcome Back
          </h2>
          <p className="text-white/40 text-sm text-center mb-8">
            Sign in to continue to Quasar Studio
          </p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-lg mb-6 flex items-start gap-2">
              <span className="mt-0.5 text-xs">⚠️</span> <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-white/30 group-focus-within:text-[#00f0ff] transition-colors" />
              </div>
              <input
                className="w-full bg-[#0d1117]/80 text-white border border-white/10 rounded-xl py-3.5 pl-11 pr-4 outline-none focus:border-[#00f0ff]/50 focus:bg-[#0d1117] focus:shadow-[0_0_15px_rgba(0,240,255,0.1)] transition-all placeholder:text-white/20"
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-white/30 group-focus-within:text-[#00f0ff] transition-colors" />
              </div>
              <input
                className="w-full bg-[#0d1117]/80 text-white border border-white/10 rounded-xl py-3.5 pl-11 pr-4 outline-none focus:border-[#00f0ff]/50 focus:bg-[#0d1117] focus:shadow-[0_0_15px_rgba(0,240,255,0.1)] transition-all placeholder:text-white/20"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-4 w-full bg-gradient-to-r from-[#00f0ff] to-[#0a58ca] text-white font-semibold py-3.5 rounded-xl shadow-[0_0_20px_rgba(0,240,255,0.2)] hover:shadow-[0_0_30px_rgba(0,240,255,0.4)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group disabled:opacity-70 disabled:pointer-events-none"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Authenticating...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <p className="text-white/40 text-sm text-center mt-8">
            Don't have an account?{" "}
            <Link href="/register" className="text-[#00f0ff] hover:text-white transition-colors font-medium">
              Create one now
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
