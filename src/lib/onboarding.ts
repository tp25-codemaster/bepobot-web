export type OnboardingStep =
  | 'welcome'
  | 'ask_apartment'
  | 'ask_wifi'
  | 'ask_cleaner'
  | 'ask_evisitor'
  | 'complete'

export interface OnboardingState {
  step: OnboardingStep
  apartmentName?: string
  wifiPassword?: string
  cleanerName?: string
  usesEvisitor?: boolean
}

interface OnboardingResult {
  botMessages: string[]
  nextStep: OnboardingStep
  state: OnboardingState
}

export function getWelcomeMessages(): string[] {
  return [
    'Dobrodosli! Ja sam BepoBot, vas AI asistent za apartmane. 🏠',
    'Krenimo s postavljanjem — traje manje od minute.',
    'Kako se zove vas prvi apartman?',
  ]
}

export function processOnboardingInput(
  input: string,
  state: OnboardingState
): OnboardingResult {
  const text = input.trim()

  switch (state.step) {
    case 'ask_apartment': {
      const newState = { ...state, apartmentName: text, step: 'ask_wifi' as const }
      return {
        botMessages: [
          `"${text}" — zapisano!`,
          `Koja je WiFi lozinka za ${text}? (Gosti ce je dobiti automatski pri check-inu)`,
        ],
        nextStep: 'ask_wifi',
        state: newState,
      }
    }

    case 'ask_wifi': {
      const newState = { ...state, wifiPassword: text, step: 'ask_cleaner' as const }
      return {
        botMessages: [
          'WiFi spremljen.',
          'Imate li cistacicu? Ako da, kako se zove? Ako ne, napisite "ne".',
        ],
        nextStep: 'ask_cleaner',
        state: newState,
      }
    }

    case 'ask_cleaner': {
      const hasCleaner = text.toLowerCase() !== 'ne' && text.toLowerCase() !== 'nemam'
      const newState = {
        ...state,
        cleanerName: hasCleaner ? text : undefined,
        step: 'ask_evisitor' as const,
      }
      const response = hasCleaner
        ? [`${text} — dodana kao cistacica.`]
        : ['Nema problema, mozete dodati kasnije.']

      return {
        botMessages: [
          ...response,
          'Koristite li eVisitor za prijavu gostiju? (da/ne)',
        ],
        nextStep: 'ask_evisitor',
        state: newState,
      }
    }

    case 'ask_evisitor': {
      const usesEvisitor = text.toLowerCase().startsWith('da')
      const newState = { ...state, usesEvisitor, step: 'complete' as const }
      const evisitorMsg = usesEvisitor
        ? 'Odlicno! Unesite vas eVisitor login u Postavke (bočni meni → eVisitor) i ja cu automatski prijavljivati goste.'
        : 'Nema problema — mozete povezati eVisitor kasnije u postavkama.'

      return {
        botMessages: [
          evisitorMsg,
          `Sve je spremno! Evo sto mozete probati:`,
          `• "Sto imam ovaj tjedan?" — pregled rasporeda\n• "Nova rezervacija" — upis gostiju\n• "Prijavi goste na eVisitor" — automatska prijava`,
        ],
        nextStep: 'complete',
        state: newState,
      }
    }

    default:
      return {
        botMessages: ['Nesto je poslo krivo. Pokusajte ponovo.'],
        nextStep: state.step,
        state,
      }
  }
}
