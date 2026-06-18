<script setup lang="ts">
import { useRouter } from 'vue-router'
import SettingsDialog from '../components/SettingsDialog.vue'

const router = useRouter()

function startGame(): void {
  void router.push({ name: 'game' })
}
</script>

<template>
  <main class="settings-shell">
    <div class="settings-preview" aria-hidden="true">
      <div class="preview-board" />
    </div>
    <SettingsDialog show-start @start="startGame" />
  </main>
</template>
