export type OnboardingStep =
  | 'welcome'
  | 'ask_name'
  | 'ask_apartment'
  | 'ask_wifi'
  | 'ask_cleaner'
  | 'ask_cleaner_contact'
  | 'ask_evisitor'
  | 'ask_gmail'
  | 'setup_summary'
  | 'complete'

export interface OnboardingState {
  step: OnboardingStep
  fullName?: string
  apartmentName?: string
  wifiPassword?: string
  cleanerName?: string
  cleanerContact?: string
  usesEvisitor?: boolean
  usesGmail?: boolean
}

interface OnboardingResult {
  botMessages: string[]
  nextStep: OnboardingStep
  state: OnboardingState
  // Special actions the UI should handle
  action?: 'save_apartment' | 'save_cleaner' | 'save_name' | 'open_evisitor' | 'open_gmail' | 'complete_onboarding'
  actionData?: Record<string, string>
}

export function getWelcomeMessages(): string[] {
  return [
    'Dobrodosli u BepoBot! Ja sam vas AI asistent za apartmane.',
    'Postavimo sve za 2 minute da mogu poceti raditi za vas.',
    'Kako se zovete?',
  ]
}

export function processOnboardingInput(
  input: string,
  state: OnboardingState
): OnboardingResult {
  const text = input.trim()

  switch (state.step) {
    case 'ask_name': {
      return {
        botMessages: [
          `Drago mi je, ${text}!`,
          'Kako se zove vas apartman? (ako imate vise, pocnite s prvim)',
        ],
        nextStep: 'ask_apartment',
        state: { ...state, fullName: text, step: 'ask_apartment' },
        action: 'save_name',
        actionData: { fullName: text },
      }
    }

    case 'ask_apartment': {
      return {
        botMessages: [
          `"${text}" — odlicno ime!`,
          `Koja je WiFi lozinka za ${text}? Gosti ce je automatski dobiti pri check-inu.`,
        ],
        nextStep: 'ask_wifi',
        state: { ...state, apartmentName: text, step: 'ask_wifi' },
      }
    }

    case 'ask_wifi': {
      return {
        botMessages: [
          'WiFi spremljen.',
          'Imate li cistacicu ili spremacu? Ako da, kako se zove? Ako ne, napisite "ne".',
        ],
        nextStep: 'ask_cleaner',
        state: { ...state, wifiPassword: text, step: 'ask_cleaner' },
        action: 'save_apartment',
        actionData: { name: state.apartmentName || '', wifi: text },
      }
    }

    case 'ask_cleaner': {
      const hasCleaner = !['ne', 'nemam', 'nema', 'n'].includes(text.toLowerCase())
      if (!hasCleaner) {
        return {
          botMessages: [
            'OK, mozete dodati kasnije.',
            'Koristite li eVisitor za prijavu gostiju? (da/ne)',
          ],
          nextStep: 'ask_evisitor',
          state: { ...state, step: 'ask_evisitor' },
        }
      }
      return {
        botMessages: [
          `${text} — super! Koji je njen email ili broj telefona?`,
        ],
        nextStep: 'ask_cleaner_contact',
        state: { ...state, cleanerName: text, step: 'ask_cleaner_contact' },
      }
    }

    case 'ask_cleaner_contact': {
      return {
        botMessages: [
          `Spremljeno! Kad budete trebali obavijestiti ${state.cleanerName}, samo mi recite.`,
          'Koristite li eVisitor za prijavu gostiju? (da/ne)',
        ],
        nextStep: 'ask_evisitor',
        state: { ...state, cleanerContact: text, step: 'ask_evisitor' },
        action: 'save_cleaner',
        actionData: { name: state.cleanerName || '', contact: text },
      }
    }

    case 'ask_evisitor': {
      const usesEvisitor = ['da', 'yes', 'koristim'].includes(text.toLowerCase())
      if (usesEvisitor) {
        return {
          botMessages: [
            'Odlicno! Za povezivanje eVisitora trebam vas OIB i lozinku.',
            'Idite u bocni meni → eVisitor → unesite podatke. Ja cu automatski prijavljivati goste!',
            'Jeste li povezali? Napisite "gotovo" kad zavrsite, ili "preskoci" za kasnije.',
          ],
          nextStep: 'ask_gmail',
          state: { ...state, usesEvisitor: true, step: 'ask_gmail' },
          action: 'open_evisitor',
        }
      }
      return {
        botMessages: [
          'Nema problema — mozete povezati eVisitor kasnije u postavkama.',
          'Zadnje pitanje: zelite li da pratim vas Gmail inbox za nove rezervacije? Kad dobijete email od Booking.com ili Airbnb-a, automatski cu vas obavijestiti. (da/ne)',
        ],
        nextStep: 'ask_gmail',
        state: { ...state, usesEvisitor: false, step: 'ask_gmail' },
      }
    }

    case 'ask_gmail': {
      const lower = text.toLowerCase()
      // Handle "gotovo" from eVisitor step
      if (['gotovo', 'done', 'preskoci', 'skip'].includes(lower)) {
        return {
          botMessages: [
            'Zelite li da pratim vas Gmail za nove rezervacije? Kad dobijete booking od Booking.com/Airbnb-a, automatski vas obavijestim. (da/ne)',
          ],
          nextStep: 'ask_gmail',
          state: { ...state },
        }
      }

      const usesGmail = ['da', 'yes', 'zelim'].includes(lower)
      if (usesGmail) {
        return {
          botMessages: [
            'Super! Kliknite "Povezi Gmail" u postavkama — traje 10 sekundi.',
            'Bocni meni → Postavke → Gmail → Povezi Gmail',
            'Napisite "gotovo" kad zavrsite, ili "preskoci".',
          ],
          nextStep: 'setup_summary',
          state: { ...state, usesGmail: true, step: 'setup_summary' },
          action: 'open_gmail',
        }
      }
      return {
        botMessages: [
          'OK, mozete povezati Gmail kad god zelite u postavkama.',
        ],
        nextStep: 'setup_summary',
        state: { ...state, usesGmail: false, step: 'setup_summary' },
      }
    }

    case 'setup_summary': {
      // Final step — show summary and complete
      const apt = state.apartmentName || 'vas apartman'
      const cleaner = state.cleanerName ? `Cistacica: ${state.cleanerName}` : 'Cistacica: dodajte kasnije'
      const evisitor = state.usesEvisitor ? 'eVisitor: povezan' : 'eVisitor: povezi u postavkama'
      const gmail = state.usesGmail ? 'Gmail: povezan' : 'Gmail: povezi u postavkama'

      return {
        botMessages: [
          `Sve je spremno! Evo sto sam postavio:\n\nApartman: ${apt}\n${cleaner}\n${evisitor}\n${gmail}`,
          `Sad mozete:\n• Pitati me "sto imam ovaj tjedan?" za pregled\n• Reci "javi cistacici" da obavijestim spremacu\n• Dodati rezervaciju u bocnom meniju\n• Pitati me bilo sto o apartmanima`,
          'Sretno s gostima! Ja sam tu kad zatrebate.',
        ],
        nextStep: 'complete',
        state: { ...state, step: 'complete' },
        action: 'complete_onboarding',
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
