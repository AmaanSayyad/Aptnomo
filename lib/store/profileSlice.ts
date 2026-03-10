import { StateCreator } from 'zustand';
import { supabase } from '../supabase/client';

export interface ProfileState {
    username: string | null;
    accessCode: string | null;
    isUpdatingUsername: boolean;
    recentTrades: any[];
    isLoadingTrades: boolean;

    fetchProfile: (address: string) => Promise<void>;
    updateUsername: (address: string, username: string) => Promise<boolean>;
    fetchRecentTrades: (address: string) => Promise<void>;
}

export const createProfileSlice: StateCreator<ProfileState> = (set, get) => ({
    username: (typeof window !== 'undefined' && localStorage.getItem('binomo_username')) || null,
    accessCode: (typeof window !== 'undefined' && localStorage.getItem('binomo_access_code')) || null,
    isUpdatingUsername: false,
    recentTrades: [],
    isLoadingTrades: false,

    fetchProfile: async (address: string) => {
        const addrStr = address?.toString();
        if (!addrStr || addrStr.startsWith('0xDEMO')) return;
        try {
            const { data, error } = await supabase
                .from('user_profiles')
                .select('username, access_code')
                .ilike('user_address', addrStr)
                .single();

            if (data) {
                set({
                    username: data.username,
                    accessCode: data.access_code
                });
                if (typeof window !== 'undefined') {
                    if (data.username) localStorage.setItem('binomo_username', data.username);
                    if (data.access_code) localStorage.setItem('binomo_access_code', data.access_code);
                }
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
        }
    },

    updateUsername: async (address: string, username: string) => {
        set({ isUpdatingUsername: true });
        try {
            // Check if username is already taken
            const { data: existing } = await supabase
                .from('user_profiles')
                .select('user_address')
                .eq('username', username)
                .single();

            if (existing && existing.user_address !== address) {
                throw new Error('Username already taken');
            }

            const { error } = await supabase
                .from('user_profiles')
                .upsert({
                    user_address: address.toLowerCase(),
                    username: username,
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;

            set({ username });
            return true;
        } catch (error: any) {
            console.error('Error updating username:', error);
            return false;
        } finally {
            set({ isUpdatingUsername: false });
        }
    },

    fetchRecentTrades: async (address: string) => {
        set({ isLoadingTrades: true });
        try {
            const res = await fetch(`/api/bets/history?wallet=${encodeURIComponent(address)}&limit=10`);
            if (res.ok) {
                const { bets } = await res.json();
                set({ recentTrades: bets || [] });
            } else {
                console.error('Error fetching recent trades from API');
            }
        } catch (error) {
            console.error('Error fetching recent trades:', error);
        } finally {
            set({ isLoadingTrades: false });
        }
    }
});
