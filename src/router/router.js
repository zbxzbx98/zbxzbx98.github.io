import { createRouter, createWebHistory } from 'vue-router';  
import Effect from '../views/Effect.vue';  
import Home from '../views/Home.vue';  
import Solve from '../views/Solve.vue';  
import NikkeCalc from '../views/NikkeCalc.vue';  
import AffixCalc from '../views/AffixCalc.vue';  
  
const routes = [  
  { path: '/',name:"Effect", component: Effect },  
  { path: '/Home',name:"Home", component: Home },
  { path: '/Solve',name:"Solve", component: Solve},
  { path: '/NikkeCalc',name:"NikkeCalc", component: NikkeCalc},
  { path: '/AffixCalc',name:"AffixCalc", component: AffixCalc}
];  
  
const router = createRouter({  
  history: createWebHistory(),  
  routes  
});  
  
export default router;
