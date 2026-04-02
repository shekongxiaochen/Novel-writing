import { createRouter, createWebHistory } from 'vue-router'
import NovelListView from './views/NovelListView.vue'
import NovelWorkspaceView from './views/NovelWorkspaceView.vue'
import NovelChapterHubView from './views/NovelChapterHubView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'novels',
      component: NovelListView,
    },
    {
      path: '/novels/:id',
      name: 'novel-workspace',
      component: NovelWorkspaceView,
      props: true,
    },
    {
      path: '/novels/:novelId/chapter-writing',
      name: 'novel-chapter-writing',
      component: NovelChapterHubView,
    },
  ],
})

