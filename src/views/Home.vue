<template>
    <div class="backgr" ref="vantaRef">
        <h1 class="homeh">都说了没制作，点进来干啥awa</h1>
        <div style="text-align: center;">
            <a href="https://space.bilibili.com/385525872?spm_id_from=333.1007.0.0" target= "_blank">
                <el-button color="#1fa2ff" plain>点击进入我的b站主页</el-button>
            </a>
            <br><br>
            <el-button color="#1fa2ff" plain @click="$router.push('Solve')">在线数独求解器</el-button>
            <br><br>
            <el-button color="#1fa2ff" plain @click="$router.push('NikkeCalc')">NIKKE前哨基地计算器</el-button>
        </div>

        <h2 class="homeh">代表作</h2>
        <div style="text-align: center;">
            <div class="vidiodiv">
                <iframe src="//player.bilibili.com/player.html?aid=600051274&bvid=BV1ZB4y1W7gB&cid=763759503&p=1&Autoplay=0" scrolling="no" frameborder="no" framespacing="0" allowfullscreen="true"> </iframe>
                <p>
                    【光遇】全图167常驻光之翼光翼收集教程（附带像素地图及动态追踪引路）
                </p>
            </div>
            <div class="vidiodiv">
                <iframe src="//player.bilibili.com/player.html?aid=704828081&bvid=BV1bQ4y1s72M&cid=1303710786&p=1&Autoplay=0" scrolling="no" frameborder="no" framespacing="0" allowfullscreen="true"> </iframe>
                <p>
                    [完蛋！我被美女包围了！]全结局100%探索度剧情（纯录屏）
                </p>
            </div>
        </div>
    </div>
</template>
<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import * as THREE from "three";
import NET from "vanta/src/vanta.net";
 
const vantaRef = ref();
let vantaEffect;
 
onMounted(() => {
  vantaEffect = NET({
    el: vantaRef.value,
    THREE: THREE,
    mouseControls: true,
    touchControls: true,
    gyroControls: false,
    minHeight: 200.0,
    minWidth: 200.0,
    scale: 1.0,
    scaleMobile: 1.0,
    color: 0xc7d1e8,
    backgroundColor: 0xffffff,
    points: 13.0,
    maxDistance: 21.0,
    spacing: 16.0
  });
});
 
onUnmounted(() => {
  if (vantaEffect) {
    vantaEffect.destroy();
  }
});
</script>

<style>
.backgr{
    position : absolute;
	width : 100%;
	height : 100%;
    /* background: linear-gradient(0deg, #1fa2ff 0%, #12d8fa 10%,#ffffff 20%,#ffffff 90%, #a6ffcb 100%); */
    /* background: linear-gradient(0deg, #1fa2ff 0%,#ffffff 30%,#ffffff 80%, #a6ffcb 100%); */
}


.homeh{
    text-align: center;
}

.vidiodiv{
    display: inline-block;
    width: 300px;
    margin: 0px 10px;
}

</style>