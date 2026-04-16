import { useEffect, useState } from 'react'
import AppShell from '../../components/app/AppShell'
import EmptyState from '../../components/app/EmptyState'
import ErrorBanner from '../../components/app/ErrorBanner'
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

const DEMO_CONTACTS: Contact[] = [
  { id: '1', name: 'Marica Horvat', role: 'cleaner', phone: '091 234 5678', email: null },
  { id: '2', name: 'Ivan Kovac', role: 'maintenance', phone: '098 765 4321', email: null },
]

const EMPTY: Contact = { id: '', name: '', role: 'cleaner', phone: '', email: '' }

export default function KontaktiPage() {
  const { user } = useAuth()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
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
    setLoadError(null)
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: true })
    if (error) {
      setLoadError('Greška pri učitavanju kontakata. Provjeri vezu i pokušaj ponovo.')
      setLoading(false)
      return
    }
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
      <div className="p-4 space-y-3 max-w-2xl mx-auto">
        {loadError && (
          <ErrorBanner message={loadError} onRetry={loadContacts} onDismiss={() => setLoadError(null)} />
        )}

        {loading ? (
          <div className="p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {contacts.map(contact => (
              <div key={contact.id} className="bg-white rounded-xl border border-border p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-lg flex-shrink-0" aria-hidden="true">
                    {ROLE_ICONS[contact.role]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-text text-sm truncate">{contact.name}</div>
                    <div className="text-xs text-text-muted">{ROLE_LABELS[contact.role]}</div>
                    {contact.phone && (
                      <a
                        href={`tel:${contact.phone.replace(/\s/g, '')}`}
                        className="text-primary text-sm font-medium mt-1 block"
                        aria-label={`Nazovi ${contact.name}`}
                      >
                        {contact.phone}
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setEditing({ ...contact })}
                      className="text-xs text-primary font-medium px-2 py-1 rounded-md hover:bg-primary/10 active:bg-primary/20 transition-colors"
                      aria-label={`Uredi kontakt ${contact.name}`}
                    >
                      Uredi
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(contact.id)}
                      className="text-xs text-red-500 font-medium px-2 py-1 rounded-md hover:bg-red-50 active:bg-red-100 transition-colors"
                      aria-label={`Obriši kontakt ${contact.name}`}
                    >
                      Obriši
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {contacts.length === 0 && !editing && (
              <EmptyState
                icon="👥"
                title="Nemate još kontakata"
                description="Dodajte čistačicu, sudomaćina ili održavanje da BepoBot može automatski obavijestiti pravu osobu kad gost dolazi ili odlazi."
                actionLabel="Dodaj prvi kontakt"
                onAction={() => setEditing({ ...EMPTY })}
              />
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
