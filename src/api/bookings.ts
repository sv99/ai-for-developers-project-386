// Записи: чтение, бронирование, отмена.
import { request } from './client'
import type { Booking, BookingInput } from './types'

export const listBookings = (): Promise<Booking[]> => request('GET', '/bookings')

export const listUpcomingBookings = (): Promise<Booking[]> =>
  request('GET', '/bookings/upcoming')

export const createBooking = (input: BookingInput): Promise<Booking> =>
  request('POST', '/bookings', input)

export const cancelBooking = (id: string): Promise<Booking> =>
  request('POST', `/bookings/${encodeURIComponent(id)}/cancel`)
