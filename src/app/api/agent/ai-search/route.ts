import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export interface AiOption {
  vendor: string
  description: string
  priceUsd: number
}

export interface AiSearchResult {
  flights: AiOption[]
  hotels: AiOption[]
  cars: AiOption[]
  taxis: AiOption[]
}

function searchFlights(
  origin: string,
  destination: string,
  departureDate: string,
  returnDate: string,
  cabinClass: string
): AiOption[] {
  const dest = destination.toLowerCase()
  const base = dest.includes('london') ? 420 : dest.includes('paris') ? 380 : dest.includes('new york') ? 780 : 350
  const mul = cabinClass === 'BUSINESS' ? 3.2 : cabinClass === 'FIRST' ? 5.5 : 1
  return [
    {
      vendor: 'United Airlines',
      description: `${cabinClass} ${origin.toUpperCase()} → ${destination.toUpperCase()}, dep ${departureDate} 7:30 AM / ret ${returnDate} 6:00 PM`,
      priceUsd: Math.round(base * mul * 0.95),
    },
    {
      vendor: 'Delta Air Lines',
      description: `${cabinClass} ${origin.toUpperCase()} → ${destination.toUpperCase()}, dep ${departureDate} 11:45 AM / ret ${returnDate} 8:15 PM`,
      priceUsd: Math.round(base * mul * 0.82),
    },
    {
      vendor: 'American Airlines',
      description: `${cabinClass} ${origin.toUpperCase()} → ${destination.toUpperCase()} via ORD, dep ${departureDate} 6:00 AM / ret ${returnDate} 4:30 PM`,
      priceUsd: Math.round(base * mul * 1.15),
    },
  ]
}

function searchHotels(city: string, checkIn: string, checkOut: string, nights: number): AiOption[] {
  const c = city.toLowerCase()
  const rate = c.includes('london') ? 195 : c.includes('paris') ? 175 : c.includes('new york') ? 310 : 140
  return [
    {
      vendor: 'Marriott',
      description: `Marriott ${city} City Center — ${nights} nights (${checkIn} → ${checkOut}), breakfast included`,
      priceUsd: Math.round(rate * nights * 1.05),
    },
    {
      vendor: 'Hilton',
      description: `Hilton ${city} — ${nights} nights (${checkIn} → ${checkOut}), free WiFi, fitness center`,
      priceUsd: Math.round(rate * nights * 0.95),
    },
    {
      vendor: 'citizenM',
      description: `citizenM ${city} — ${nights} nights (${checkIn} → ${checkOut}), modern design, all-inclusive`,
      priceUsd: Math.round(rate * nights * 0.78),
    },
  ]
}

function searchTaxis(city: string, pickupDate: string): AiOption[] {
  return [
    {
      vendor: 'Uber',
      description: `Uber Black — airport transfer in ${city}, ${pickupDate}, luggage included`,
      priceUsd: 75,
    },
    {
      vendor: 'Bolt',
      description: `Bolt Comfort — city transfers in ${city} from ${pickupDate}, pre-booked`,
      priceUsd: 52,
    },
    {
      vendor: 'Local Taxi',
      description: `Pre-booked local taxi in ${city} — fixed rate from ${pickupDate}`,
      priceUsd: 40,
    },
  ]
}

function searchRentalCars(city: string, pickupDate: string, returnDate: string, days: number): AiOption[] {
  const rate = 65
  return [
    {
      vendor: 'Hertz',
      description: `Hertz ${city} — Compact (Toyota Corolla), ${days} days (${pickupDate} → ${returnDate}), unlimited miles`,
      priceUsd: Math.round(rate * days * 0.98),
    },
    {
      vendor: 'Avis',
      description: `Avis ${city} — Intermediate (Honda Accord), ${days} days (${pickupDate} → ${returnDate}), GPS included`,
      priceUsd: Math.round(rate * days * 1.05),
    },
    {
      vendor: 'Enterprise',
      description: `Enterprise ${city} — Economy (Hyundai Elantra), ${days} days (${pickupDate} → ${returnDate}), full coverage`,
      priceUsd: Math.round(rate * days * 0.85),
    },
  ]
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const allowedRoles = ['TRAVEL_AGENT', 'EMPLOYEE']
  if (!session?.user?.companyId || !allowedRoles.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { travelRequestId } = await req.json()
  if (!travelRequestId) return NextResponse.json({ error: 'travelRequestId required' }, { status: 400 })

  const request = await prisma.travelRequest.findFirst({
    where: { id: travelRequestId, companyId: session.user.companyId },
  })
  if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const dates = request.travelDates as { departureDate: string; returnDate: string }
  const dep = new Date(dates.departureDate)
  const ret = new Date(dates.returnDate)
  const diffDays = Math.max(1, Math.round((ret.getTime() - dep.getTime()) / 86_400_000))
  const nights = request.hotelNights ?? diffDays
  const days = request.carRentalDays ?? diffDays
  const services = request.servicesRequested as string[]

  const result: AiSearchResult = { flights: [], hotels: [], cars: [], taxis: [] }

  if (services.includes('FLIGHT')) {
    result.flights = searchFlights(
      request.origin,
      request.destination,
      dates.departureDate,
      dates.returnDate,
      request.preferredClass
    )
  }

  if (services.includes('HOTEL')) {
    result.hotels = searchHotels(
      request.destination,
      dates.departureDate,
      dates.returnDate,
      nights
    )
  }

  if (services.includes('CAR_RENTAL')) {
    result.cars = searchRentalCars(
      request.destination,
      dates.departureDate,
      dates.returnDate,
      days
    )
  }

  if (services.includes('TAXI')) {
    result.taxis = searchTaxis(request.destination, dates.departureDate)
  }

  return NextResponse.json(result)
}
