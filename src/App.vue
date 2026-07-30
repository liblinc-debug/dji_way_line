<script setup>
import { computed } from 'vue'
import AdminConsole from './components/AdminConsole.vue'
import WaypointGenerator from './components/WaypointGenerator/index.vue';

const isAdminView = computed(() => {
  const query = new URLSearchParams(window.location.search)
  return query.get('view') === 'admin'
})
</script>

<template>
  <AdminConsole v-if="isAdminView" />
  <WaypointGenerator v-else />
</template>

<style>
body {
  margin: 0;
  background-color: #f5f7fa;
}
</style>
