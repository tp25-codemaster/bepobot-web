import { useState } from 'react'
import AppShell from '../../components/app/AppShell'

interface Contact {
  id: string
  name: string
  role: 'cleaner' | 'cohost' | 'maintenance'
  phone: string
}

const ROLE_LABELS: Record<string, string> = {
  cleaner: 'Cistacica',
  cohost: 'Sudomacin',
  maintenance: 'Odrzavanje',
}

const ROLE_ICONS: Record<string, string> = {
  cleaner: '🧹',
  cohost: '👥',
  maintenance: '🔧',
}

const DEMO_CONTACTS: Contact[] = [
  { id: '1', name: 'Marica Horvat', role: 'cleaner', phone: '091 234 5678' },
  { id: '2', name: 'Ivan Kovac', role: 'maintenance', phone: '098 765 4321' },
]

export default function KontaktiPage() {
  const [contacts] = useState<Contact[]>(DEMO_CONTACTS)
  const [showForm, setShowForm] = useState(false)

  return (
    <AppShell title="Kontakti">
      <div className="p-4 space-y-3">
        {contacts.map(contact => (
          <div key={contact.id} className="bg-white rounded-xl border border-border p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-lg">
                  {ROLE_ICONS[contact.role]}
                </div>
                <div>
                  <div className="font-semibold text-text text-sm">{contact.name}</div>
                  <div className="text-xs text-text-muted">{ROLE_LABELS[contact.role]}</div>
                </div>
              </div>
              <a
                href={`tel:${contact.phone.replace(/\s/g, '')}`}
                className="text-primary text-sm font-medium"
              >
                {contact.phone}
              </a>
            </div>
          </div>
        ))}

        <button
          onClick={() => setShowForm(!showForm)}
          className="w-full py-3 border-2 border-dashed border-border rounded-xl text-text-muted text-sm font-medium hover:border-primary hover:text-primary transition-colors"
        >
          + Dodaj kontakt
        </button>

        {showForm && (
          <div className="bg-white rounded-xl border border-border p-4 space-y-3">
            <input
              type="text"
              placeholder="Ime i prezime"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
            />
            <select className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-primary outline-none bg-white">
              <option value="cleaner">Cistacica</option>
              <option value="cohost">Sudomacin</option>
              <option value="maintenance">Odrzavanje</option>
            </select>
            <input
              type="tel"
              placeholder="Broj telefona"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
            />
            <input
              type="email"
              placeholder="Email (opcionalno)"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
            />
            <div className="flex gap-2">
              <button className="flex-1 py-2 bg-primary text-white text-sm font-semibold rounded-lg">
                Spremi
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2 bg-gray-100 text-text-muted text-sm font-medium rounded-lg"
              >
                Odustani
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
