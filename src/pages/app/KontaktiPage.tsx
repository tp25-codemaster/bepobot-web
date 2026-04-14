import { useEffect, useState } from 'react'
import AppShell from '../../components/app/AppShell'
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
  cleaner: 'Cistacica',
  cohost: 'Sudomacin',
  maintenance: 'Odrzavanje',
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
  const [editing, setEditing] = useState<Contact | null>(null)
  const [saving, setSaving] = useState(false)

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
    if (!confirm('Obrisati kontakt?')) return

    if (isDemoMode) {
      setContacts(prev => prev.filter(c => c.id !== id))
      return
    }

    await supabase.from('contacts').delete().eq('id', id)
    await loadContacts()
  }

  return (
    <AppShell title="Kontakti">
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="text-center text-text-muted py-8">Ucitavanje...</div>
        ) : (
          <>
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
                  <div className="flex items-center gap-3">
                    {contact.phone && (
                      <a
                        href={`tel:${contact.phone.replace(/\s/g, '')}`}
                        className="text-primary text-sm font-medium"
                      >
                        {contact.phone}
                      </a>
                    )}
                    <button
                      onClick={() => setEditing({ ...contact })}
                      className="text-xs text-primary font-medium"
                    >
                      Uredi
                    </button>
                    <button
                      onClick={() => handleDelete(contact.id)}
                      className="text-xs text-red-500 font-medium"
                    >
                      Obrisi
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {contacts.length === 0 && !editing && (
              <div className="text-center py-8">
                <div className="text-3xl mb-2">👥</div>
                <div className="text-text-muted text-sm">Nemate jos kontakata. Dodajte prvog!</div>
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
            <input
              type="text"
              value={editing.name}
              onChange={e => setEditing({ ...editing, name: e.target.value })}
              placeholder="Ime i prezime *"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
            />
            <select
              value={editing.role}
              onChange={e => setEditing({ ...editing, role: e.target.value as ContactRole })}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-primary outline-none bg-white"
            >
              <option value="cleaner">🧹 Cistacica</option>
              <option value="cohost">👥 Sudomacin</option>
              <option value="maintenance">🔧 Odrzavanje</option>
            </select>
            <input
              type="tel"
              value={editing.phone || ''}
              onChange={e => setEditing({ ...editing, phone: e.target.value })}
              placeholder="Broj telefona"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
            />
            <input
              type="email"
              value={editing.email || ''}
              onChange={e => setEditing({ ...editing, email: e.target.value })}
              placeholder="Email (opcionalno)"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
            />
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
    </AppShell>
  )
}
