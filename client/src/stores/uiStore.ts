import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIState {
  // Game settings
  setGameSettingsListOpen: (isOpen: boolean) => void
  setGameSettingsDialogOpen: (isOpen: boolean) => void
  setGameSettingsEdit: (edit: boolean) => void
  setSelectedSettingsId: (id: number | null) => void
  isGameSettingsListOpen: boolean
  isGameSettingsDialogOpen: boolean
  gameSettingsEdit: boolean
  selectedSettingsId: number | null

  // Client preferences
  setUseMobileClient: (useMobile: boolean) => void
  useMobileClient: boolean

  // Animations
  setSkipIntroOutro: (skip: boolean) => void
  setSkipAllAnimations: (skip: boolean) => void
  setFastBattle: (fast: boolean) => void
  setSkipFirstBattle: (skip: boolean) => void
  skipIntroOutro: boolean
  skipAllAnimations: boolean
  fastBattle: boolean
  skipFirstBattle: boolean

  // Exploration controls
  setShowUntilBeastToggle: (show: boolean) => void
  showUntilBeastToggle: boolean

  // Referral tracking
  referralClicked: boolean
  setReferralClicked: (clicked: boolean) => void

  // Advanced mode (always enabled, toggle is no-op)
  setAdvancedMode: (advanced: boolean) => void
  advancedMode: boolean
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Game settings
      setGameSettingsListOpen: (isOpen) => set({ isGameSettingsListOpen: isOpen }),
      setGameSettingsDialogOpen: (isOpen) => set({ isGameSettingsDialogOpen: isOpen }),
      setGameSettingsEdit: (edit) => set({ gameSettingsEdit: edit }),
      setSelectedSettingsId: (id) => set({ selectedSettingsId: id }),
      isGameSettingsListOpen: false,
      isGameSettingsDialogOpen: false,
      gameSettingsEdit: false,
      selectedSettingsId: null,

      // Animations
      setSkipIntroOutro: (skip) => set({ skipIntroOutro: skip }),
      setSkipAllAnimations: (skip) => set({ skipAllAnimations: skip }),
      setFastBattle: (fast) => set({ fastBattle: fast }),
      setSkipFirstBattle: (skip) => set({ skipFirstBattle: skip }),
      skipIntroOutro: false,
      skipAllAnimations: false,
      fastBattle: false,
      skipFirstBattle: false,

      // Exploration controls
      setShowUntilBeastToggle: (show) => set({ showUntilBeastToggle: show }),
      showUntilBeastToggle: true,

      // Advanced mode (always enabled - no-op setter)
      setAdvancedMode: () => {},
      advancedMode: true,

      // Client preferences
      setUseMobileClient: (useMobile) => set({ useMobileClient: useMobile }),
      useMobileClient: false,

      // Referral tracking
      referralClicked: false,
      setReferralClicked: (clicked) => set({ referralClicked: clicked }),
    }),
    {
      name: 'death-mountain-ui-settings',
      partialize: (state) => ({
        useMobileClient: state.useMobileClient,
        skipIntroOutro: state.skipIntroOutro,
        skipAllAnimations: state.skipAllAnimations,
        fastBattle: state.fastBattle,
        skipFirstBattle: state.skipFirstBattle,
        showUntilBeastToggle: state.showUntilBeastToggle,
        referralClicked: state.referralClicked,
        advancedMode: state.advancedMode,
      }),
      merge: (persistedState, currentState) => {
        const state = persistedState as Partial<UIState> & { skipCombatDelays?: boolean };
        return {
          ...currentState,
          ...state,
          fastBattle: state.fastBattle ?? state.skipCombatDelays ?? currentState.fastBattle,
          advancedMode: true, // Always force advancedMode to true regardless of persisted state
        };
      },
    }
  )
)
