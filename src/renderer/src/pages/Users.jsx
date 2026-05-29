import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import { useDialog } from '../components/Dialog'
import { IconPlus, IconTrash } from '../components/icons'

export default function Users() {
  const { user: me } = useAuth()
  const { confirm, alert } = useDialog()
  const [users, setUsers] = useState([])
  const [editing, setEditing] = useState(null)

  const load = () => api.users.list().then(setUsers)
  useEffect(() => {
    load()
  }, [])

  const save = async (form) => {
    try {
      if (form.id) await api.users.update(form)
      else await api.users.create(form)
      setEditing(null)
      load()
    } catch (e) {
      alert({ title: 'Error', message: e.message })
    }
  }

  const remove = async (u) => {
    if (!(await confirm({ title: 'Delete user', message: `Delete user “${u.name || u.username}”?`, confirmText: 'Delete', danger: true }))) return
    try {
      await api.users.remove(u.id)
      load()
    } catch (e) {
      alert({ title: 'Error', message: e.message })
    }
  }

  return (
    <div className="h-full flex flex-col p-7 overflow-hidden">
      <PageHeader title="Users" subtitle={`${users.length} account${users.length === 1 ? '' : 's'}`}>
        <button className="btn-accent" onClick={() => setEditing({ username: '', name: '', pin: '', role: 'user' })}>
          <IconPlus width={20} height={20} /> Add user
        </button>
      </PageHeader>

      <div className="card flex-1 overflow-y-auto">
        <table className="w-full text-left">
          <thead className="sticky top-0 bg-surface text-muted text-sm z-10">
            <tr>
              <th className="px-5 py-4 font-medium">Name</th>
              <th className="px-5 py-4 font-medium">Username</th>
              <th className="px-5 py-4 font-medium text-center">Role</th>
              <th className="px-5 py-4 font-medium text-center">Status</th>
              <th className="px-5 py-4"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-line/60 text-lg hover:bg-surface2/40">
                <td className="px-5 py-3.5 font-semibold">
                  {u.name || u.username}
                  {u.id === me.id && <span className="text-muted text-sm font-normal"> (you)</span>}
                </td>
                <td className="px-5 py-3.5 text-muted">{u.username}</td>
                <td className="px-5 py-3.5 text-center">
                  <span className={`chip ${u.role === 'admin' ? 'bg-ember/15 text-ember' : 'bg-surface3 text-muted'}`}>
                    {u.role === 'admin' ? 'Administrator' : 'Cashier'}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-center">
                  {u.active ? <span className="chip bg-mint/15 text-mint">Active</span> : <span className="chip bg-surface3 text-muted">Disabled</span>}
                </td>
                <td className="px-5 py-3.5 text-right whitespace-nowrap">
                  <button className="px-3 py-2 rounded-xl bg-surface2 border border-line mr-2 hover:bg-surface3" onClick={() => setEditing({ ...u, pin: '' })}>Edit</button>
                  <button className="px-3 py-2 rounded-xl bg-berry/80 text-white hover:bg-berry disabled:opacity-40" disabled={u.id === me.id} onClick={() => remove(u)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && <UserModal user={editing} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  )
}

function UserModal({ user, onClose, onSave }) {
  const [form, setForm] = useState(user)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const isNew = !user.id
  return (
    <Modal title={isNew ? 'New user' : `Edit ${user.username}`} onClose={onClose}>
      {isNew && (
        <label className="block">
          <span className="text-muted text-sm">Username (used to sign in)</span>
          <input className="input mt-1.5" value={form.username} autoFocus onChange={(e) => set('username', e.target.value)} />
        </label>
      )}
      <label className="block">
        <span className="text-muted text-sm">Display name</span>
        <input className="input mt-1.5" value={form.name} onChange={(e) => set('name', e.target.value)} />
      </label>
      <label className="block">
        <span className="text-muted text-sm">{isNew ? 'PIN (min 4 digits)' : 'New PIN (leave blank to keep)'}</span>
        <input className="input mt-1.5 tnum" inputMode="numeric" type="password" value={form.pin} onChange={(e) => set('pin', e.target.value.replace(/\D/g, ''))} />
      </label>
      <div>
        <span className="text-muted text-sm">Role</span>
        <div className="grid grid-cols-2 gap-2 mt-1.5">
          {[['user', 'Cashier'], ['admin', 'Administrator']].map(([v, label]) => (
            <button key={v} onClick={() => set('role', v)} className={`py-3 rounded-2xl font-semibold border transition ${form.role === v ? 'bg-ember text-[#2a1c0c] border-ember' : 'bg-surface2 border-line text-muted hover:text-cream'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {!isNew && (
        <label className="flex items-center gap-3">
          <input type="checkbox" className="w-6 h-6 accent-[#EC9A45]" checked={!!form.active} onChange={(e) => set('active', e.target.checked ? 1 : 0)} />
          <span>Active (can sign in)</span>
        </label>
      )}
      <div className="flex gap-3 pt-1">
        <button className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
        <button className="btn-accent flex-1" disabled={(isNew && (!form.username.trim() || form.pin.length < 4))} onClick={() => onSave(form)}>Save</button>
      </div>
    </Modal>
  )
}
