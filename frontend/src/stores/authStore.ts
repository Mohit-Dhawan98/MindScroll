import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User } from '@/types'
import { authAPI } from '@/lib/api'

interface AuthState {
  user: User | null
  token: string | null
  loading: boolean
  error: string | null
  hasHydrated: boolean
  
  // Actions
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => void
  fetchUser: () => Promise<void>
  updateProfile: (data: any) => Promise<void>
  clearError: () => void
  setHasHydrated: (state: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      loading: false,
      error: null,
      hasHydrated: false,

      login: async (email: string, password: string) => {
        set({ loading: true, error: null })
        try {
          const response = await authAPI.login({ email, password })
          const { token, user } = response.data.data || response.data
          
          set({ user, token, loading: false })
        } catch (error: any) {
          const errorMessage = error.response?.data?.error || 'Login failed'
          set({ error: errorMessage, loading: false })
          throw error
        }
      },

      register: async (email: string, password: string, name: string) => {
        set({ loading: true, error: null })
        try {
          const response = await authAPI.register({ email, password, name })
          const { token, user } = response.data.data || response.data
          
          set({ user, token, loading: false })
        } catch (error: any) {
          const errorMessage = error.response?.data?.error || 'Registration failed'
          set({ error: errorMessage, loading: false })
          throw error
        }
      },

      logout: () => {
        set({ user: null, token: null, error: null })
      },

      fetchUser: async () => {
        const token = get().token
        if (!token) return

        set({ loading: true })
        try {
          const response = await authAPI.getMe()
          const user = response.data.data || response.data.user
          set({ user, loading: false })
        } catch (error: any) {
          console.error('Failed to fetch user:', error)
          // Don't set error here as it might be a network issue
          set({ loading: false })
        }
      },

      updateProfile: async (data: any) => {
        set({ loading: true, error: null })
        try {
          const response = await authAPI.updateProfile(data)
          const user = response.data.data || response.data.user
          set({ user, loading: false })
        } catch (error: any) {
          const errorMessage = error.response?.data?.error || 'Profile update failed'
          set({ error: errorMessage, loading: false })
          throw error
        }
      },

      clearError: () => set({ error: null }),
      
      setHasHydrated: (state: boolean) => set({ hasHydrated: state }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        token: state.token 
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)