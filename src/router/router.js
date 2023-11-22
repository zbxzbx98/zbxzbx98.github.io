import { createRouter, createWebHistory } from 'vue-router';  
import Effect from '../components/Effect.vue';  
import Home from '../components/Home.vue';  
  
const routes = [  
  { path: '/',name:"Effect", component: Effect },  
  { path: '/Home',name:"Home", component: Home }  
];  
  
const router = createRouter({  
  history: createWebHistory(),  
  routes  
});  
  
export default router;