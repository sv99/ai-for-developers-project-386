// Записи: чтение, бронирование, отмена. Пути и методы — из сгенерированного SDK (контракт).
import { request } from './client'
import type { Booking, BookingInput } from './types'

export const listBookings = (): Promise<Booking[]> => request<Booking[]>((api) => api.listBookings())

export const listUpcomingBookings = (): Promise<Booking[]> =>
  request<Booking[]>((api) => api.listUpcomingBookings())

export const createBooking = (input: BookingInput): Promise<Booking> =>
  request<Booking>((api) => api.createBooking(input))

export const cancelBooking = (id: string): Promise<Booking> =>
  request<Booking>((api) => api.cancelBooking(id))
