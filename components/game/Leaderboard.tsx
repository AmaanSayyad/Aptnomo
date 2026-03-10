'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LeaderboardEntry {
    wallet_address: string;
    username: string | null;
    total_bets: number;
    wins: number;
    losses: number;
    total_wagered: number;
    total_payout: number;
    net_profit: number;
    win_rate: number;
    primary_network: string;
}

interface FeedEntry {
    id: string;
    wallet_address: string;
    username: string | null;
    asset: string;
    direction: string;
    amount: number;
    multiplier: number;
    payout: number;
    won: boolean;
    mode: string;
    network: string;
    resolved_at: string;
}

export const Leaderboard: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'rankings' | 'feed'>('rankings');
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [feed, setFeed] = useState<FeedEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const getNetworkIcon = (network: string) => {
        switch (network) {
            case 'APT':
            case 'APTOS': return '/logos/apt-logo.svg';
            default: return '/logos/apt-logo.svg';
        }
    };

    const fetchLeaderboard = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/bets/leaderboard?limit=25');
            if (res.ok) {
                const data = await res.json();
                setLeaderboard(data.leaderboard || []);
            }
        } catch (err) {
            console.error('Failed to fetch leaderboard:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const fetchFeed = useCallback(async () => {
        setIsLoading(true);
        try {
            // Fetch ALL recent bets (wallet=all or no wallet)
            const res = await fetch('/api/bets/history?limit=30');
            if (res.ok) {
                const data = await res.json();
                // Map the results to FeedEntry
                const bets = data.bets || [];

                // Fetch usernames for these bets
                const addresses = [...new Set(bets.map((b: any) => b.wallet_address.toLowerCase()))];
                if (addresses.length > 0) {
                    const profileRes = await fetch('/api/profiles/bulk', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ addresses })
                    }).catch(() => null);

                    let usernameMap: Record<string, string> = {};
                    if (profileRes && profileRes.ok) {
                        const profileData = await profileRes.json();
                        profileData.profiles?.forEach((p: any) => {
                            usernameMap[p.user_address.toLowerCase()] = p.username;
                        });
                    }

                    const mappedFeed = bets.map((b: any) => ({
                        ...b,
                        username: usernameMap[b.wallet_address.toLowerCase()] || null
                    }));
                    setFeed(mappedFeed);
                } else {
                    setFeed(bets);
                }
            }
        } catch (err) {
            console.error('Failed to fetch feed:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const refreshData = useCallback(() => {
        if (activeTab === 'rankings') fetchLeaderboard();
        else fetchFeed();
    }, [activeTab, fetchLeaderboard, fetchFeed]);

    useEffect(() => {
        if (isOpen) {
            refreshData();
        }
    }, [isOpen, refreshData]);

    // Auto-refresh every 15s when open
    useEffect(() => {
        if (!isOpen) return;
        const interval = setInterval(refreshData, 15000);
        return () => clearInterval(interval);
    }, [isOpen, refreshData]);

    const shortenAddress = (addr: string) => {
        if (!addr) return '???';
        if (addr.length <= 10) return addr;
        return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`px-4 py-2 rounded-full border transition-all duration-300 flex items-center gap-2 group shadow-lg shrink-0 ${isOpen
                    ? 'bg-amber-500 text-white border-amber-400 shadow-amber-500/30'
                    : 'bg-black/60 text-white border-white/10 hover:border-white/30 hover:bg-black/80'
                    }`}
            >
                <span className="text-sm">🏆</span>
                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Leaderboard</span>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)} />
                        <motion.div
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 20, scale: 0.95 }}
                            className="fixed bottom-24 sm:bottom-20 right-4 sm:right-20 z-[9999] w-[calc(100vw-32px)] sm:w-[360px] bg-[#0d0d0d]/95 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-4 shadow-2xl flex flex-col"
                        >
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">🏆</span>
                                    <h3 className="text-[11px] text-white font-black uppercase tracking-[0.2em]">Leaderboard</h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={refreshData} disabled={isLoading} className="text-gray-500 hover:text-purple-400 p-1">
                                        <svg className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                    </button>
                                    <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-white p-1">✕</button>
                                </div>
                            </div>

                            {/* Tabs */}
                            <div className="flex bg-white/5 rounded-xl p-1 mb-4">
                                <button
                                    onClick={() => setActiveTab('rankings')}
                                    className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'rankings' ? 'bg-amber-500 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    Rankings
                                </button>
                                <button
                                    onClick={() => setActiveTab('feed')}
                                    className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'feed' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    Live Feed
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto scrollbar-none no-scrollbar max-h-[400px]">
                                {isLoading && (activeTab === 'rankings' ? leaderboard.length === 0 : feed.length === 0) ? (
                                    <div className="py-12 text-center">
                                        <div className="animate-spin w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-2" />
                                        <p className="text-gray-500 text-xs">Loading {activeTab}...</p>
                                    </div>
                                ) : activeTab === 'rankings' ? (
                                    <div className="space-y-1.5">
                                        {leaderboard.length > 0 ? (
                                            leaderboard.map((entry, index) => (
                                                <div key={entry.wallet_address} className={`bg-white/5 border border-white/5 rounded-xl p-2.5 flex items-center justify-between hover:bg-white/10 transition-all ${index === 0 ? 'border-yellow-500/30' : ''}`}>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-6 text-center text-xs font-black">{index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}</div>
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <img src={getNetworkIcon(entry.primary_network)} className="w-3 h-3 opacity-80" />
                                                                <p className="text-white text-[10px] font-bold truncate">{entry.username || shortenAddress(entry.wallet_address)}</p>
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <span className="text-[8px] text-gray-500">{entry.total_bets} bets</span>
                                                                <span className="text-[8px] text-green-400 font-bold">{entry.win_rate.toFixed(0)}% WR</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className={`text-[10px] font-black ${entry.net_profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                            {entry.net_profit >= 0 ? '+' : ''}{entry.net_profit.toFixed(4)} APT
                                                        </p>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="py-12 text-center opacity-40">No rank data yet</div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        {feed.length > 0 ? (
                                            feed.map((bet) => (
                                                <div key={bet.id} className="bg-white/5 border border-white/5 rounded-xl p-2.5 flex items-center justify-between hover:bg-white/10 transition-all">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ${bet.won ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                            {bet.won ? 'WIN' : 'LOSS'}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-white text-[10px] font-bold truncate">{bet.username || shortenAddress(bet.wallet_address)}</p>
                                                            <p className="text-[8px] text-gray-500 mt-0.5">
                                                                {bet.asset} · {bet.mode === 'box' ? 'Box' : 'Standard'} · {new Date(bet.resolved_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className={`text-[10px] font-black ${bet.won ? 'text-green-400' : 'text-gray-400'}`}>
                                                            {bet.won ? `+${bet.payout.toFixed(3)}` : `-${bet.amount.toFixed(3)}`}
                                                        </p>
                                                        <p className="text-[7px] text-gray-600 font-black">APT</p>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="py-12 text-center opacity-40">Waiting for trades...</div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 pt-3 border-t border-white/5">
                                <p className="text-[8px] text-gray-600 text-center font-medium uppercase tracking-widest">
                                    {activeTab === 'rankings' ? 'Ranked by net profit' : 'Real-time trade stream'}
                                </p>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
};
