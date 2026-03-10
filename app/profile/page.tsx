'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useStore, useHouseBalance, useWalletAddress, useIsConnected, useUserTier, useBetHistory, useHistoryActions } from '@/lib/store';
import { calculateBetStats } from '@/lib/store/historySlice';
import { Wallet, Trophy, User as UserIcon, History, Link as LinkIcon, Share2, Check, Edit2, Zap, Shield, Crown, LayoutGrid, Activity, ExternalLink, Key, ShieldCheck } from 'lucide-react';

const TIER_DATA = [
    {
        id: 'free',
        name: 'Free',
        color: 'text-gray-400',
        borderColor: 'border-gray-800',
        bgColor: 'bg-gray-400/5',
        iconComp: Shield,
        assets: 'All',
        blitz: 'Enabled',
        payout: '100.0%',
        withdrawal: 'Instant',
        fee: '2.0%',
        requirement: '$0',
    },
    {
        id: 'standard',
        name: 'Standard',
        color: 'text-amber-400',
        borderColor: 'border-amber-800/30',
        bgColor: 'bg-amber-400/5',
        iconComp: Zap,
        assets: 'All',
        blitz: 'Enabled',
        payout: '100.0%',
        withdrawal: 'Instant',
        fee: '1.75%',
        requirement: '$50',
    },
    {
        id: 'vip',
        name: 'VIP',
        color: 'text-purple-400',
        borderColor: 'border-purple-800/30',
        bgColor: 'bg-purple-400/5',
        iconComp: Crown,
        assets: 'All',
        blitz: 'Enabled',
        payout: '100.0%',
        withdrawal: 'Instant',
        fee: '1.5%',
        requirement: '$500',
    }
];

export default function ProfilePage() {
    const isConnected = useIsConnected();
    const address = useWalletAddress();
    const houseBalance = useHouseBalance();
    const userTier = useUserTier();
    const betHistory = useBetHistory();
    const { fetchHistory } = useHistoryActions();
    const {
        username,
        updateUsername,
        fetchRecentTrades,
        recentTrades,
        isLoadingTrades,
        referralCode,
        referralCount,
        accessCode,
        network
    } = useStore();

    const currentTierIndex = TIER_DATA.findIndex(t => t.id === userTier);
    const safeTierIndex = currentTierIndex === -1 ? 0 : currentTierIndex;
    const currentTierData = TIER_DATA[safeTierIndex];
    const nextTier = TIER_DATA[safeTierIndex + 1];

    const [isEditing, setIsEditing] = useState(false);
    const [newUsername, setNewUsername] = useState('');
    const [copySuccess, setCopySuccess] = useState<string | null>(null);
    const [isTierModalOpen, setIsTierModalOpen] = useState(false);

    useEffect(() => {
        if (username) {
            setNewUsername(username.replace('.creditnomo', ''));
        }
    }, [username]);

    useEffect(() => {
        if (address) {
            fetchRecentTrades(address);
            fetchHistory(address);
        }
    }, [address, fetchRecentTrades, fetchHistory]);

    const stats = calculateBetStats(betHistory);
    const totalBets = stats.totalBets;
    const profitableTrades = stats.wins;
    const netProfit = stats.netProfit;

    const handleUpdateUsername = async () => {
        if (!address || !newUsername) return;
        const formattedUsername = `${newUsername.toLowerCase()}.creditnomo`;
        const success = await updateUsername(address, formattedUsername);
        if (success) {
            setIsEditing(false);
        } else {
            alert('Username already taken or invalid.');
        }
    };

    const copyToClipboard = (text: string, type: string) => {
        navigator.clipboard.writeText(text);
        setCopySuccess(type);
        setTimeout(() => setCopySuccess(null), 2000);
    };

    if (!isConnected) {
        return (
            <div className="min-h-screen bg-[#02040a] flex flex-col items-center justify-center p-6 text-center">
                <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mb-8">
                    <Wallet className="w-8 h-8 text-white/40" />
                </div>
                <h1 className="text-2xl font-black text-white uppercase tracking-widest mb-4 font-orbitron">CREDITNOMO Registry</h1>
                <p className="text-gray-500 max-w-xs mx-auto text-[10px] font-bold uppercase tracking-[0.2em] leading-relaxed mb-8">
                    Synchronization required. Please authorize your wallet to access neural trading identity.
                </p>
                <div className="w-full max-w-xs h-[1px] bg-white/10" />
            </div>
        );
    }

    const shortenAddr = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

    return (
        <main className="min-h-screen bg-[#02040a] text-white selection:bg-white selection:text-black">
            {/* Header / Identity Bar */}
            <div className="border-b border-white/5 bg-[#050505] sticky top-0 z-40 px-6 py-6 md:px-12">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center font-black text-2xl text-white/60">
                            {username ? username[0].toUpperCase() : '?'}
                        </div>
                        <div className="space-y-1">
                            {isEditing ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={newUsername}
                                        onChange={(e) => setNewUsername(e.target.value)}
                                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 font-bold text-lg text-white focus:outline-none focus:border-white/20"
                                        autoFocus
                                    />
                                    <button onClick={handleUpdateUsername} className="p-2 bg-white text-black rounded-lg hover:bg-gray-200 transition-all">
                                        <Check className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => setIsEditing(false)} className="text-[10px] uppercase font-black text-white/40 hover:text-white ml-2">Cancel</button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 group">
                                    <h1 className="text-2xl font-black tracking-tighter sm:text-3xl">
                                        {username || 'Anonymous Node'}
                                    </h1>
                                    <button onClick={() => setIsEditing(true)} className="p-1.5 opacity-0 group-hover:opacity-100 bg-white/5 hover:bg-white/10 rounded-lg transition-all text-white/30 hover:text-white">
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-mono text-white/40">{shortenAddr(address || '')}</span>
                                <div className="w-1 h-1 bg-white/20 rounded-full" />
                                <span className={`text-[9px] font-black uppercase tracking-widest ${currentTierData.color}`}>{userTier} STATUS</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20 mb-1">Treasury Balance</p>
                            <p className="text-xl font-bold font-mono">{houseBalance.toFixed(2)} <span className="text-xs text-white/40">{network}</span></p>
                        </div>
                        <div className="w-[1px] h-10 bg-white/5 mx-2 hidden md:block" />
                        <Link href="/referrals" className="px-5 py-3 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-gray-200 transition-all active:scale-95 shadow-xl">
                            Referral System
                        </Link>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 md:px-12 py-12">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

                    {/* Left Column: Data Stream & Social */}
                    <div className="lg:col-span-8 space-y-16">

                        {/* Highlights Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <StatCard label="Total Refs" value={referralCount} icon={UserIcon} />
                            <StatCard label="Total Bets Placed" value={totalBets} icon={History} />
                            <StatCard label="Profitable Trades" value={profitableTrades} icon={Trophy} />
                            <StatCard
                                label={`Net Profit (${network})`}
                                value={netProfit.toFixed(4)}
                                icon={Activity}
                                status={netProfit >= 0 ? 'emerald' : undefined}
                            />
                        </div>

                        {/* Recent History */}
                        <section className="space-y-8">
                            <div className="flex items-center justify-between">
                                <h2 className="text-sm font-black uppercase tracking-[0.4em] text-white/20 flex items-center gap-3">
                                    <Activity className="w-4 h-4" /> Trading Ledger
                                </h2>
                                <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[9px] font-black uppercase tracking-widest text-white/40">
                                    Last 50 Rounds
                                </div>
                            </div>

                            <div className="bg-[#050505] border border-white/5 rounded-[2rem] overflow-hidden shadow-2xl">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-white/5 bg-white/[0.01] text-[10px] uppercase font-black tracking-[0.2em] text-white/30">
                                                <th className="px-10 py-6">Asset / Time</th>
                                                <th className="px-10 py-6 text-center">Position</th>
                                                <th className="px-10 py-6">Stake</th>
                                                <th className="px-10 py-6 text-right">Settlement</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/[0.03]">
                                            {isLoadingTrades && betHistory.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="px-10 py-32 text-center">
                                                        <div className="flex flex-col items-center gap-4">
                                                            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                                            <span className="text-[10px] uppercase font-black tracking-[0.3em] text-white/20">Syncing Protocol...</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : betHistory.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="px-10 py-32 text-center">
                                                        <div className="flex flex-col items-center gap-4 opacity-20">
                                                            <History className="w-12 h-12" />
                                                            <span className="text-[10px] uppercase font-black tracking-[0.3em]">No execution data found</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : (
                                                betHistory.map((bet, idx) => (
                                                    <tr key={idx} className="group hover:bg-white/[0.02] transition-all duration-300">
                                                        <td className="px-10 py-7">
                                                            <div className="flex flex-col gap-1">
                                                                <span className="text-base font-bold text-white group-hover:text-purple-400 transition-colors uppercase tracking-tight">
                                                                    {bet.target.id === 'box' ? 'BOX MODE' : 'CLASSIC MODE'}
                                                                </span>
                                                                <span className="text-[10px] text-white/20 font-mono">
                                                                    {new Date(bet.timestamp).toLocaleString()}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-10 py-7">
                                                            <div className="flex justify-center">
                                                                <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${bet.target.direction === 'UP'
                                                                    ? 'text-emerald-400 border-emerald-400/20 bg-emerald-400/5 group-hover:bg-emerald-400/10'
                                                                    : 'text-rose-400 border-rose-400/20 bg-rose-400/5 group-hover:bg-rose-400/10'
                                                                    }`}>
                                                                    {bet.target.direction} {bet.target.multiplier}x
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-10 py-7">
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-bold font-mono">
                                                                    {Number(bet.amount).toFixed(4)}
                                                                </span>
                                                                <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">{network}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-10 py-7 text-right">
                                                            <div className="flex flex-col items-end">
                                                                <span className={`text-base font-black ${bet.won ? 'text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]' : 'text-white/10'}`}>
                                                                    {bet.won ? `+${Number(bet.payout).toFixed(4)}` : `-${Number(bet.amount).toFixed(4)}`}
                                                                </span>
                                                                <span className={`text-[9px] font-black uppercase tracking-widest ${bet.won ? 'text-emerald-400/40' : 'text-white/5'}`}>
                                                                    {bet.won ? 'COMPLETED' : 'REJECTED'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </section>


                    </div>

                    {/* Right Column: Tiers & Referral */}
                    <div className="lg:col-span-4 space-y-12">

                        {/* Tier Selector / Display */}
                        <section className="space-y-6">
                            <h2 className="text-sm font-black uppercase tracking-[0.4em] text-white/20 flex items-center gap-3">
                                <Shield className="w-4 h-4" /> Governance Tiers
                            </h2>
                            <div className="bg-[#050505] border border-white/5 rounded-3xl p-8 space-y-8">
                                <div className="flex items-center gap-5">
                                    <div className={`w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center ${currentTierData.color}`}>
                                        <currentTierData.iconComp className="w-7 h-7" />
                                    </div>
                                    <div>
                                        <p className="text-xl font-black uppercase tracking-tight">{userTier} Tier</p>
                                        <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">Active License</p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {TIER_DATA.map((t) => (
                                        <div key={t.id} className={`p-4 rounded-xl border transition-all ${t.id === userTier ? 'bg-white/5 border-white/20' : 'bg-transparent border-white/5 opacity-30 hover:opacity-100'}`}>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <t.iconComp className={`w-4 h-4 ${t.id === userTier ? t.color : ''}`} />
                                                    <span className="text-[11px] font-black uppercase tracking-widest">{t.name}</span>
                                                </div>
                                                {t.id === userTier ? (
                                                    <span className="text-[8px] font-black text-emerald-400 uppercase">Selected</span>
                                                ) : (
                                                    <span className="text-[8px] font-bold text-white/20 uppercase">{t.requirement}</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {nextTier && (
                                    <div className="pt-4 border-t border-white/5">
                                        <div className="flex justify-between text-[9px] font-black text-white/30 uppercase tracking-widest mb-3">
                                            <span>Progress to {nextTier.name} Status</span>
                                            <span>{nextTier.requirement}</span>
                                        </div>
                                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                            <div className="h-full bg-white/40" style={{ width: `${(safeTierIndex / (TIER_DATA.length - 1)) * 100}%` }} />
                                        </div>
                                    </div>
                                )}
                                <button
                                    onClick={() => setIsTierModalOpen(true)}
                                    className="mt-6 w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-[0.25em] text-white/70 transition-all"
                                >
                                    View Tier Access Rights
                                </button>
                            </div>
                        </section>

                        {/* Protocol Code */}
                        <section className="space-y-6">
                            <h2 className="text-sm font-black uppercase tracking-[0.4em] text-white/20 flex items-center gap-3">
                                <Trophy className="w-4 h-4" /> Node Protocol
                            </h2>
                            <div className="bg-[#050505] border border-white/5 rounded-3xl p-8 space-y-8">
                                <div className="space-y-3">
                                    <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Your Private Node Code</p>
                                    <div className="flex items-center justify-between gap-4 p-4 bg-white/5 border border-white/10 rounded-xl group/code">
                                        <span className="font-mono font-black text-xl text-white tracking-widest uppercase truncate">{referralCode || '---'}</span>
                                        <button onClick={() => copyToClipboard(referralCode || '', 'Code')} className="text-white/20 hover:text-white transition-all active:scale-90">
                                            {copySuccess === 'Code' ? <Check className="w-4 h-4 text-emerald-400" /> : <LinkIcon className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                                <button onClick={() => window.open(`https://twitter.com/intent/tweet?text=Join the Bynomo protocol and start trading with decentralized precision! Code: ${referralCode}`, '_blank')} className="w-full py-4 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-3">
                                    <Share2 className="w-3 h-3" /> Share Access
                                </button>
                            </div>
                        </section>

                        {/* Access Identity */}
                        <section className="space-y-6">
                            <h2 className="text-sm font-black uppercase tracking-[0.4em] text-white/20 flex items-center gap-3">
                                <Key className="w-4 h-4" /> Access Identity
                            </h2>
                            <div className="bg-[#050505] border border-white/5 rounded-3xl p-8 space-y-3">
                                <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Validated Access Token</p>
                                <div className="flex items-center justify-between gap-4 p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl group/access">
                                    <span className="font-mono font-black text-xl text-emerald-400 tracking-[0.3em] uppercase truncate">{accessCode || 'INITIALIZING'}</span>
                                    <ShieldCheck className="w-5 h-5 text-emerald-400/40" />
                                </div>
                                <p className="text-[8px] text-white/20 font-bold uppercase tracking-widest">This identity token is uniquely matched to your neural node.</p>
                            </div>
                        </section>

                    </div>
                </div>
            </div>

            {/* Governance Tiers Modal */}
            <AnimatePresence>
                {isTierModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsTierModalOpen(false)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-md"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-4xl bg-[#0a0a0b] border border-white/10 rounded-[3rem] p-8 md:p-12 shadow-[0_32px_120px_rgba(0,0,0,1)] overflow-hidden"
                        >
                            <div className="flex justify-between items-start mb-12">
                                <div>
                                    <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 mb-2">Governance Protocol</h2>
                                    <h2 className="text-3xl font-black tracking-tighter">Tier Access Rights</h2>
                                </div>
                                <button onClick={() => setIsTierModalOpen(false)} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all">
                                    <Check className="w-6 h-6 rotate-45" />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {TIER_DATA.map((t, index) => (
                                    <div
                                        key={t.id}
                                        className={`p-8 rounded-[2rem] border transition-all ${t.id === userTier
                                            ? 'bg-white/[0.04] border-white/20 shadow-[0_0_50px_rgba(255,255,255,0.03)]'
                                            : 'bg-white/[0.01] border-white/5'
                                            }`}
                                    >
                                        <div className="flex justify-between items-center mb-8">
                                            <t.iconComp className={`w-8 h-8 ${t.id === userTier ? t.color : 'text-white/20'}`} />
                                            {t.id === userTier && (
                                                <span className="text-[8px] font-black text-[#00ff88] bg-[#00ff88]/10 px-3 py-1 rounded-full border border-[#00ff88]/20 flex items-center gap-1.5">
                                                    <span className="w-1.5 h-1.5 bg-[#00ff88] rounded-full animate-pulse" />
                                                    Active
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="text-2xl font-black mb-1">{t.name}</h3>
                                        <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] mb-10">Neural Access LVL 0{index + 1}</p>

                                        <div className="space-y-6">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Payout</span>
                                                <span className="text-xs font-black text-[#00ff88]">{t.payout}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Blitz</span>
                                                <span className="text-xs font-black text-[#00ff88]">{t.blitz}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Protocol Fee</span>
                                                <span className="text-xs font-black text-[#00ff88]">{t.fee}</span>
                                            </div>
                                            <div className="pt-6 border-t border-white/5">
                                                <p className="text-[8px] font-black text-white/10 uppercase mb-1">Requirement</p>
                                                <p className="font-mono text-lg font-black text-white/40">{t.requirement}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </main>
    );
}

const StatCard = ({ label, value, icon: Icon, status }: any) => (
    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 space-y-3 hover:bg-white/[0.03] transition-all">
        <div className="flex items-center justify-between">
            <Icon className="w-4 h-4 text-white/20" />
            {status && <div className={`w-1.5 h-1.5 rounded-full ${status === 'emerald' ? 'bg-emerald-500' : 'bg-white/20'}`} />}
        </div>
        <div>
            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-1">{label}</p>
            <p className="text-2xl font-black tracking-tight">{value}</p>
        </div>
    </div>
);
