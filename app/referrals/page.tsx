'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import GridScan from '@/components/ui/GridScan';
import { useToast } from '@/lib/hooks/useToast';

export default function ReferralPage() {
    const {
        address,
        isConnected,
        referralCode,
        referralCount,
        referralLeaderboard,
        isLoadingReferrals,
        fetchReferralLeaderboard,
        fetchReferralInfo
    } = useStore();

    const toast = useToast();
    const [referralLink, setReferralLink] = useState('');

    useEffect(() => {
        fetchReferralLeaderboard();
    }, [fetchReferralLeaderboard]);

    useEffect(() => {
        if (isConnected && address) {
            fetchReferralInfo(address);
        }
    }, [isConnected, address, fetchReferralInfo]);

    useEffect(() => {
        if (referralCode && typeof window !== 'undefined') {
            setReferralLink(`${window.location.origin}/?ref=${referralCode}`);
        }
    }, [referralCode]);

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied!`);
    };

    const formatAddress = (addr: string) => {
        if (!addr) return '---';
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    const shareOnX = () => {
        const text = encodeURIComponent(`Trade with millisecond precision on @BYNOMOProtocol! 🚀\n\nJoin using my referral link and earn rewards:`);
        window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(referralLink)}`, '_blank');
    };

    return (
        <main className="min-h-screen bg-[#02040a] text-white relative overflow-hidden flex flex-col items-center py-12 px-4">
            {/* Background */}
            <div className="fixed inset-0 pointer-events-none">
                <GridScan
                    sensitivity={0.01}
                    lineThickness={1}
                    linesColor="#14141a"
                    gridScale={0.1}
                    scanColor="#A855F7"
                    scanOpacity={0.05}
                    scanDuration={12.0}
                    enablePost
                />
            </div>

            <div className="relative z-10 w-full max-w-4xl">
                {/* Header */}
                <header className="mb-12 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-block px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-[10px] font-black uppercase tracking-[0.3em] text-purple-400 mb-4"
                    >
                        Reward System
                    </motion.div>
                    <motion.h1
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-4xl md:text-6xl font-black tracking-tighter mb-4"
                        style={{ fontFamily: 'var(--font-orbitron)' }}
                    >
                        REFERRALS
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-gray-500 max-w-md mx-auto"
                    >
                        Invite your friends to Bynomo and climb the leaderboard. Each new trader using your code gets you closer to the top.
                    </motion.p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left: Your Stats */}
                    <div className="space-y-6">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 }}
                            className="bg-black/40 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-purple-500/10 transition-all duration-500" />

                            <h2 className="text-gray-400 text-xs font-black uppercase tracking-widest mb-8 border-b border-white/5 pb-4">Your Identity</h2>

                            {isConnected ? (
                                <div className="space-y-8">
                                    <div>
                                        <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2">Personal Code</p>
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-black text-2xl tracking-tight text-white font-mono">
                                                {referralCode || 'GENERATING...'}
                                            </div>
                                            <button
                                                onClick={() => copyToClipboard(referralCode || '', 'Code')}
                                                className="w-14 h-14 bg-purple-600 rounded-2xl flex items-center justify-center hover:bg-purple-500 transition-all active:scale-90"
                                            >
                                                📋
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2">Referral Link</p>
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-medium text-sm text-gray-400 truncate">
                                                {referralLink || 'Connect to see link'}
                                            </div>
                                            <button
                                                onClick={() => copyToClipboard(referralLink, 'Link')}
                                                className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center hover:bg-white/10 transition-all active:scale-90"
                                            >
                                                🔗
                                            </button>
                                        </div>
                                    </div>

                                    <button
                                        onClick={shareOnX}
                                        className="w-full bg-[#1da1f2]/10 hover:bg-[#1da1f2]/20 border border-[#1da1f2]/20 text-[#1da1f2] rounded-2xl py-4 flex items-center justify-center gap-3 font-black uppercase tracking-[0.2em] text-xs transition-all active:scale-[0.98]"
                                    >
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                        </svg>
                                        Share on X
                                    </button>

                                    <div className="grid grid-cols-2 gap-4 pt-4">
                                        <div className="bg-purple-500/5 border border-purple-500/10 rounded-3xl p-6">
                                            <p className="text-[10px] text-purple-400 font-black uppercase tracking-widest mb-1">Total Referrals</p>
                                            <p className="text-4xl font-black">{referralCount}</p>
                                        </div>
                                        <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                                            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Bonus Status</p>
                                            <p className="text-sm font-black text-white px-2 py-0.5 bg-white/10 rounded border border-white/5 inline-block mt-2">ACTIVE</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="py-12 text-center">
                                    <p className="text-gray-500 text-sm mb-6">Connect your wallet to generate your unique referral code.</p>
                                    <a href="/" className="px-8 py-3 bg-white text-black rounded-full font-black uppercase tracking-widest text-xs hover:bg-gray-200 transition-all">Launch & Connect</a>
                                </div>
                            )}
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.4 }}
                            className="bg-black/40 backdrop-blur-xl border border-white/5 rounded-[2rem] p-6"
                        >
                            <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                                Reward Details
                            </h3>
                            <ul className="space-y-3">
                                <li className="text-xs text-gray-400 flex items-start gap-3">
                                    <span className="text-purple-500">◆</span>
                                    <span>Get 10% of trading fees from your referrals.</span>
                                </li>
                                <li className="text-xs text-gray-400 flex items-start gap-3">
                                    <span className="text-purple-500">◆</span>
                                    <span>Early access to premium technical indicators.</span>
                                </li>
                                <li className="text-xs text-gray-400 flex items-start gap-3">
                                    <span className="text-purple-500">◆</span>
                                    <span>Bonus multipliers in Blitz Rounds (coming soon).</span>
                                </li>
                            </ul>
                        </motion.div>
                    </div>

                    {/* Right: Leaderboard */}
                    <div>
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 }}
                            className="bg-black/60 backdrop-blur-xl border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl h-full flex flex-col"
                        >
                            <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/2">
                                <h2 className="text-gray-400 text-xs font-black uppercase tracking-widest">Global Ranking</h2>
                                <button
                                    onClick={() => fetchReferralLeaderboard()}
                                    className={`text-purple-500 text-xs font-bold hover:text-purple-400 transition-colors ${isLoadingReferrals ? 'animate-spin' : ''}`}
                                >
                                    {isLoadingReferrals ? '⌛' : 'REFRESH'}
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto">
                                {referralLeaderboard.length > 0 ? (
                                    <div className="divide-y divide-white/5">
                                        {referralLeaderboard.map((entry, index) => (
                                            <div key={entry.user_address} className="p-6 flex items-center justify-between hover:bg-white/2 transition-all">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs border ${index === 0 ? 'bg-amber-500/20 border-amber-500/50 text-amber-500' :
                                                        index === 1 ? 'bg-gray-400/20 border-gray-400/50 text-gray-400' :
                                                            index === 2 ? 'bg-orange-500/20 border-orange-500/50 text-orange-500' :
                                                                'bg-white/5 border-white/10 text-gray-500'
                                                        }`}>
                                                        {index + 1}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black text-white font-mono">{formatAddress(entry.user_address)}</p>
                                                        {entry.user_address === address && (
                                                            <span className="text-[8px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/30 font-black uppercase tracking-widest">You</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-lg font-black text-white tracking-widest">{entry.referral_count}</p>
                                                    <p className="text-[9px] text-gray-600 font-black uppercase tracking-widest">Refs</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-24 text-center">
                                        <div className="text-4xl mb-4 opacity-20">🏆</div>
                                        <p className="text-gray-600 text-sm font-bold uppercase tracking-widest">No rankings yet</p>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 bg-purple-600/5 border-t border-white/5 text-center">
                                <p className="text-[9px] text-gray-600 font-black uppercase tracking-widest">Live stats updated every 30 seconds</p>
                            </div>
                        </motion.div>
                    </div>
                </div>

                {/* Footer Link */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="mt-12 text-center"
                >
                    <a href="/" className="text-gray-600 text-xs font-black uppercase tracking-[0.2em] hover:text-white transition-all flex items-center justify-center gap-2">
                        <span className="text-lg">←</span> Back to Trading Floor
                    </a>
                </motion.div>
            </div>
        </main>
    );
}
