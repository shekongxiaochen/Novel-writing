import { createRouter, createWebHashHistory } from 'vue-router'
import NovelListView from './views/novel-list/NovelListView.vue'
import NovelWorkspaceView from './views/workspace/NovelWorkspaceView.vue'
import NovelChapterHubView from './views/chapter-hub/NovelChapterHubView.vue'
import AuthView from './views/auth/AuthView.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'novels',
      component: NovelListView,
    },
    {
      path: '/login',
      name: 'login',
      component: AuthView,
      props: { mode: 'login' },
    },
    {
      path: '/register',
      name: 'register',
      component: AuthView,
      props: { mode: 'register' },
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
