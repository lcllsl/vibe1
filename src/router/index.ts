import { createRouter, createWebHistory } from 'vue-router'
import GameView from '../views/GameView.vue'
import SettingsView from '../views/SettingsView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'settings',
      component: SettingsView,
    },
    {
      path: '/game',
      name: 'game',
      component: GameView,
    },
  ],
})
