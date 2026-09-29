import { createRouter, createWebHistory } from 'vue-router'

import LandingPage from '@/views/LandingPage.vue'

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'landing', component: LandingPage },
    { path: '/booking', name: 'booking', component: () => import('@/views/BookingPage.vue') },
    { path: '/events', name: 'events', component: () => import('@/views/EventsPage.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
