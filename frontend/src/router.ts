import { createRouter, createWebHistory } from 'vue-router'
import NovelListView from './views/novel-list/NovelListView.vue'
import NovelWorkspaceView from './views/workspace/NovelWorkspaceView.vue'
import NovelChapterHubView from './views/chapter-hub/NovelChapterHubView.vue'

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

