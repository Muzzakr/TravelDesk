'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, User, Phone, Mail, MapPin, Calendar, CreditCard, Plane, Globe, Building2, CheckCircle, XCircle } from 'lucide-react'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'

type AirlineAccount = { airline: string; number: string }

type TravelerProfile = {
  firstName: string | null
  lastName: string | null
  phoneNumber: string | null
  contactEmail: string | null
  homeAddress: string | null
  dateOfBirth: string | null
  passportNumber: string | null
  passportIssueDate: string | null
  passportExpiry: string | null
  driversLicenseNumber: string | null
  driversLicenseIssueDate: string | null
  driversLicenseExpiry: string | null
  ktnNumber: string | null
  globalEntryNumber: string | null
  airlineAccounts: AirlineAccount[] | null
}

type TravelRequest = {
  id: string
  origin: string
  destination: string
  status: string
  travelDates: Record<string, string>
  servicesRequested: string[]
  estimatedCostUsd: string | null
  preferredClass: string
  purpose: string
  createdAt: string
  event: { eventName: string; eventCode: string }
}

type Expense = {
  id: string
  category: string
  description: string
  amountUsd: string
  status: string
  transactionDate: string | null
  service: string | null
}

type Employee = {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  createdAt: string
  manager: { id: string; name: string; email: string } | null
  travelerProfile: TravelerProfile | null
  travelRequests: TravelRequest[]
  expenses: Expense[]
}

function fmt(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50">
        <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-1.5 text-sm border-b border-gray-50 last:border-0">
      <span className="text-gray-400 w-40 shrink-0">{label}</span>
      <span className="text-gray-900 font-medium break-all">{value ?? '—'}</span>
    </div>
  )
}

export default function EmployeeProfilePage() {
  const { id } = useParams<{ id: string }>()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/agent/employees/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setEmployee(data)
      })
      .catch(() => setError('Failed to load profile'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="flex items-center justify-center min-h-[40vh] text-gray-400 text-sm">Loading profile…</div>
  )

  if (error || !employee) return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-2">
      <p className="text-red-500 text-sm">{error || 'Employee not found'}</p>
      <Link href="/agent/bookings" className="text-indigo-600 text-sm hover:underline">← Back to bookings</Link>
    </div>
  )

  const tp = employee.travelerProfile
  const airlineAccounts: AirlineAccount[] = Array.isArray(tp?.airlineAccounts) ? tp!.airlineAccounts : []
  const fullName = [tp?.firstName, tp?.lastName].filter(Boolean).join(' ') || employee.name

  const totalSpend = employee.expenses.reduce((s, e) => s + Number(e.amountUsd), 0)
  const totalTrips = employee.travelRequests.length

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-12">
      {/* Back */}
      <Link href="/agent/bookings" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-600 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to bookings
      </Link>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-start gap-5 flex-wrap">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-xl font-bold shrink-0">
            {initials(employee.name)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{fullName}</h1>
              {employee.isActive ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 px-2.5 py-0.5 text-xs font-semibold">
                  <CheckCircle className="w-3 h-3" /> Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-500 px-2.5 py-0.5 text-xs font-semibold">
                  <XCircle className="w-3 h-3" /> Inactive
                </span>
              )}
              <span className="rounded-full bg-indigo-100 text-indigo-700 px-2.5 py-0.5 text-xs font-semibold">
                {employee.role.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{employee.email}</p>
            {employee.manager && (
              <p className="text-xs text-gray-400 mt-1">Reports to <span className="font-medium text-gray-600">{employee.manager.name}</span></p>
            )}
          </div>

          {/* KPI chips */}
          <div className="flex gap-4 flex-wrap">
            <div className="text-center px-4 py-2 rounded-xl bg-indigo-50">
              <p className="text-lg font-bold text-indigo-700">{totalTrips}</p>
              <p className="text-[10px] text-indigo-400 uppercase font-semibold tracking-wide">Trips</p>
            </div>
            <div className="text-center px-4 py-2 rounded-xl bg-emerald-50">
              <p className="text-lg font-bold text-emerald-700">${totalSpend.toFixed(0)}</p>
              <p className="text-[10px] text-emerald-400 uppercase font-semibold tracking-wide">Expenses</p>
            </div>
            <div className="text-center px-4 py-2 rounded-xl bg-gray-50">
              <p className="text-lg font-bold text-gray-700">{fmt(employee.createdAt).split(' ').slice(1).join(' ')}</p>
              <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide">Member since</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Contact information */}
        <Section title="Contact information">
          {!tp ? (
            <p className="text-sm text-amber-600">Traveler profile not yet completed.</p>
          ) : (
            <>
              <Row label={<span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> Phone</span>} value={tp.phoneNumber} />
              <Row label={<span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> Contact email</span>} value={tp.contactEmail} />
              <Row label={<span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> Account email</span>} value={employee.email} />
              <Row label={<span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Home address</span>} value={tp.homeAddress} />
              <Row label={<span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Date of birth</span>} value={fmt(tp.dateOfBirth)} />
            </>
          )}
        </Section>

        {/* Travel documents */}
        <Section title="Travel documents">
          {!tp ? (
            <p className="text-sm text-amber-600">No documents on file.</p>
          ) : (
            <>
              <div className="mb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5" /> Passport
                </p>
                <Row label="Number" value={tp.passportNumber} />
                <Row label="Issued" value={fmt(tp.passportIssueDate)} />
                <Row label="Expiry" value={fmt(tp.passportExpiry)} />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5" /> Driver&apos;s licence
                </p>
                <Row label="Number" value={tp.driversLicenseNumber} />
                <Row label="Issued" value={fmt(tp.driversLicenseIssueDate)} />
                <Row label="Expiry" value={fmt(tp.driversLicenseExpiry)} />
              </div>
            </>
          )}
        </Section>

        {/* Travel programs */}
        <Section title="Travel programs">
          {!tp ? (
            <p className="text-sm text-amber-600">No programs on file.</p>
          ) : (
            <>
              <Row label={<span className="flex items-center gap-1"><Globe className="w-3.5 h-3.5" /> KTN / TSA PreCheck</span>} value={tp.ktnNumber} />
              <Row label={<span className="flex items-center gap-1"><Globe className="w-3.5 h-3.5" /> Global Entry</span>} value={tp.globalEntryNumber} />
              {airlineAccounts.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1 mb-2">
                    <Plane className="w-3.5 h-3.5" /> Airline loyalty accounts
                  </p>
                  {airlineAccounts.map((a, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                      <span className="font-medium text-gray-700">{a.airline}</span>
                      <span className="text-gray-500 font-mono text-xs">{a.number}</span>
                    </div>
                  ))}
                </div>
              )}
              {airlineAccounts.length === 0 && !tp.ktnNumber && !tp.globalEntryNumber && (
                <p className="text-sm text-gray-400">No travel programs added yet.</p>
              )}
            </>
          )}
        </Section>

        {/* Manager & org */}
        <Section title="Organisation">
          <Row label={<span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> Role</span>} value={employee.role.replace(/_/g, ' ')} />
          <Row label={<span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> Manager</span>} value={employee.manager?.name ?? '—'} />
          <Row label="Manager email" value={employee.manager?.email ?? '—'} />
          <Row label="Member since" value={fmt(employee.createdAt)} />
          <Row label="Status" value={employee.isActive ? 'Active' : 'Inactive'} />
        </Section>
      </div>

      {/* Travel history */}
      <Section title={`Travel history (${employee.travelRequests.length})`}>
        {employee.travelRequests.length === 0 ? (
          <p className="text-sm text-gray-400">No travel requests yet.</p>
        ) : (
          <div className="space-y-2">
            {employee.travelRequests.map(r => {
              const dates = r.travelDates as Record<string, string>
              return (
                <Link
                  key={r.id}
                  href={`/agent/requests/${r.id}`}
                  className="flex items-start justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 hover:bg-indigo-50 hover:border-indigo-100 px-4 py-3 transition-colors group"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900 group-hover:text-indigo-700">
                        {r.origin} → {r.destination}
                      </p>
                      <Badge variant={statusToBadgeVariant(r.status)}>{r.status.replace(/_/g, ' ')}</Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {r.event.eventName} · {dates.departureDate} → {dates.returnDate}
                    </p>
                    <p className="text-xs text-gray-400">{(r.servicesRequested as string[]).join(', ')} · {r.preferredClass}</p>
                  </div>
                  {r.estimatedCostUsd && (
                    <span className="text-sm font-bold text-gray-700 shrink-0">${Number(r.estimatedCostUsd).toFixed(0)}</span>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </Section>

      {/* Expense history */}
      {employee.expenses.length > 0 && (
        <Section title={`Recent expenses (${employee.expenses.length})`}>
          <div className="space-y-2">
            {employee.expenses.map(e => (
              <div key={e.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{e.description}</p>
                  <p className="text-xs text-gray-400">{e.service ?? e.category} · {e.transactionDate ? fmt(e.transactionDate) : '—'}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={statusToBadgeVariant(e.status)}>{e.status}</Badge>
                  <span className="text-sm font-bold text-gray-700">${Number(e.amountUsd).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}
