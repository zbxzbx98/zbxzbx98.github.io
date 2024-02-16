import { createRouter, createWebHistory } from 'vue-router';  
import Effect from '../views/Effect.vue';  
import Home from '../views/Home.vue';  
  
const routes = [  
  { path: '/',name:"Effect", component: Effect },  
  { path: '/Home',name:"Home", component: Home }  
];  
  
const router = createRouter({  
  history: createWebHistory(),  
  routes  
});  
  
export default router;