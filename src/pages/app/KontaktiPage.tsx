import { useEffect, useState } from 'react'
import AppShell from '../../components/app/AppShell'
import ConfirmModal from '../../components/ConfirmModal'
import { useAuth } from '../../contexts/AuthContext'
import { supabase, isDemoMode } from '../../lib/supabase'

type ContactRole = 'cleaner' | 'cohost' | 'maintenance'

interface Contact {
  id: string
  name: string
  role: ContactRole
  phone: string | null
  email: string | null
}

const ROLE_LABELS: Record<ContactRole, string> = {
  cleaner: 'Čistačica',
  cohost: 'Sudomaćin',
  maintenance: 'Održavanje',
}

const ROLE_ICONS: Record<ContactRole, string> = {
  cleaner: '🧹',
  cohost: '👥',
  maintenance: '🔧',
}

const ROLE_COLORS: Record<ContactRole, string> = {
  cleaner: 'bg-teal-500',
  cohost: 'bg-blue-500',
  maintenance: 'bg-amber-500',
}

const DEMO_CONTACTS: Contact[] = [
  { id: '1', name: 'Marica Horvat', role: 'cleaner', phone: '091 234 5678', email: null },
  { id: '2', name: 'Ivan Kovac', role: 'maintenance', phone: '098 765 4321', email: null },
]

const EMPTY: Contact = { id: '', name: '', role: 'cleaner', phone: '', email: '' }

export default function KontaktiPage() {
  const { user } = useAuth()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Contact | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  useEffect(() => {
    if (isDemoMode) {
      setContacts(DEMO_CONTACTS)
      setLoading(false)
      return
    }
    if (!user) return
    loadContacts()
  }, [user])

  async function loadContacts() {
    setLoading(true)
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: true })
    setContacts((data as Contact[]) || [])
    setLoading(false)
  }

  async function handleSave() {
    if (!editing || !editing.name.trim()) return
    setSaving(true)

    if (isDemoMode) {
      if (editing.id) {
        setContacts(prev => prev.map(c => c.id === editing.id ? editing : c))
      } else {
        setContacts(prev => [...prev, { ...editing, id: Date.now().toString() }])
      }
      setEditing(null)
      setSaving(false)
      return
    }

    if (editing.id) {
      await supabase
        .from('contacts')
        .update({
          name: editing.name,
          role: editing.role,
          phone: editing.phone || null,
          email: editing.email || null,
        })
        .eq('id', editing.id)
    } else {
      await supabase
        .from('contacts')
        .insert({
          user_id: user!.id,
          name: editing.name,
          role: editing.role,
          phone: editing.phone || null,
          email: editing.email || null,
        })
    }

    await loadContacts()
    setEditing(null)
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (isDemoMode) {
      setContacts(prev => prev.filter(c => c.id !== id))
      setDeleteConfirmId(null)
      return
    }

    await supabase.from('contacts').delete().eq('id', id)
    setDeleteConfirmId(null)
    await loadContacts()
  }

  return (
    <AppShell title="Kontakti">
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {contacts.length === 0 && !editing ? (
              <div className="text-center py-12 px-4">
                <svg viewBox="0 0 80 80" className="w-20 h-20 mx-auto mb-4 text-primary opacity-25" fill="currentColor">
                  <circle cx="28" cy="26" r="11"/>
                  <path d="M6 62 Q28 44 50 62Z"/>
                  <circle cx="52" cy="26" r="11"/>
                  <path d="M30 62 Q52 44 74 62Z"/>
                </svg>
                <h3 className="text-base font-semibold text-text mb-1">Nemate još kontakata</h3>
                <p className="text-sm text-text-muted max-w-xs mx-auto">Dodajte čistačicu, sudomaćina ili održavanje da BepoBot može automatski obavijestiti pravu osobu kad gost dolazi ili odlazi.</p>
                <button
                  onClick={() => setEditing({ ...EMPTY })}
                  className="mt-4 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 active:scale-95 transition-all"
                >
                  Dodaj prvi kontakt
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {contacts.map(contact => {
                  const initials = contact.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
                  return (
                    <div key={contact.id} className="bg-white rounded-2xl border border-border p-4 flex flex-col gap-3">
                      <div className="flex flex-col items-center gap-2">
                        <div className={`w-14 h-14 rounded-full ${ROLE_COLORS[contact.role]} flex items-center justify-center text-white font-bold text-lg`} aria-hidden="true">
                          {initials || ROLE_ICONS[contact.role]}
                        </div>
                        <div className="text-center min-w-0 w-full">
                          <div className="font-semibold text-text text-sm truncate">{contact.name}</div>
                          <div className="text-xs text-text-muted">{ROLE_LABELS[contact.role]}</div>
                        </div>
                      </div>
                      {contact.phone && (
                        <a
                          href={`tel:${contact.phone.replace(/\s/g, '')}`}
                          className="text-primary text-xs font-medium text-center truncate"
                          aria-label={`Nazovi ${contact.name}`}
                        >
                          {contact.phone}
                        </a>
                      )}
                      <div className="flex gap-1.5 mt-auto">
                        <button
                          onClick={() => setEditing({ ...contact })}
                          className="flex-1 text-xs text-primary font-medium py-1.5 rounded-lg hover:bg-primary/5 transition-colors"
                          aria-label={`Uredi kontakt ${contact.name}`}
                        >
                          Uredi
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(contact.id)}
                          className="flex-1 text-xs text-red-500 font-medium py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                          aria-label={`Obriši kontakt ${contact.name}`}
                        >
                          Obriši
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {!editing && (
              <button
                onClick={() => setEditing({ ...EMPTY })}
                className="w-full py-3 border-2 border-dashed border-border rounded-xl text-text-muted text-sm font-medium hover:border-primary hover:text-primary transition-colors"
              >
                + Dodaj kontakt
              </button>
            )}
          </>
        )}

        {/* Edit/Add form */}
        {editing && (
          <div className="bg-white rounded-xl border-2 border-primary/30 p-4 space-y-3">
            <h3 className="font-semibold text-text text-sm">
              {editing.id ? 'Uredi kontakt' : 'Novi kontakt'}
            </h3>
            <label className="block">
              <span className="sr-only">Ime i prezime (obavezno)</span>
              <input
                type="text"
                value={editing.name}
                onChange={e => setEditing({ ...editing, name: e.target.value })}
                placeholder="Ime i prezime *"
                aria-label="Ime i prezime"
                aria-required="true"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
            </label>
            <label className="block">
              <span className="sr-only">Uloga kontakta</span>
              <select
                value={editing.role}
                onChange={e => setEditing({ ...editing, role: e.target.value as ContactRole })}
                aria-label="Uloga kontakta"
                aria-required="true"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-primary outline-none bg-white"
              >
                <option value="cleaner">🧹 Čistačica</option>
                <option value="cohost">👥 Sudomaćin</option>
                <option value="maintenance">🔧 Održavanje</option>
              </select>
            </label>
            <label className="block">
              <span className="sr-only">Broj telefona</span>
              <input
                type="tel"
                value={editing.phone || ''}
                onChange={e => setEditing({ ...editing, phone: e.target.value })}
                placeholder="Broj telefona"
                aria-label="Broj telefona"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
            </label>
            <label className="block">
              <span className="sr-only">Email adresa</span>
              <input
                type="email"
                value={editing.email || ''}
                onChange={e => setEditing({ ...editing, email: e.target.value })}
                placeholder="Email (opcionalno)"
                aria-label="Email adresa"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
            </label>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving || !editing.name.trim()}
                className="flex-1 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? 'Spremam...' : 'Spremi'}
              </button>
              <button
                onClick={() => setEditing(null)}
                className="flex-1 py-2 bg-gray-100 text-text-muted text-sm font-medium rounded-lg"
              >
                Odustani
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        open={deleteConfirmId !== null}
        title="Obriši kontakt"
        message="Jesi li siguran/a da želiš obrisati ovaj kontakt?"
        confirmLabel="Obriši"
        onConfirm={() => deleteConfirmId && handleDelete(deleteConfirmId)}
        onCancel={() => setDeleteConfirmId(null)}
        danger
      />
    </AppShell>
  )
}
