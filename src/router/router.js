import { createRouter, createWebHistory } from 'vue-router';  
import Effect from '../views/Effect.vue';  
import Home from '../views/Home.vue';  
import Solve from '../views/Solve.vue';  
import NikkeCalc from '../views/NikkeCalc.vue';  
  
const routes = [  
  { path: '/',name:"Effect", component: Effect },  
  { path: '/Home',name:"Home", component: Home },
  { path: '/Solve',name:"Solve", component: Solve},
  { path: '/NikkeCalc',name:"NikkeCalc", component: NikkeCalc}
];  
  
const router = createRouter({  
  history: createWebHistory(),  
  routes  
});  
  
export default router;