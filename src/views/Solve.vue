<template >
    <div style="text-align: center;">
        <h1>数独求解</h1>
        <table border="1">
            <tr>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[0][0]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[0][1]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[0][2]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[0][3]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[0][4]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[0][5]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[0][6]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[0][7]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[0][8]"/></td>
            </tr>
            <tr>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[1][0]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[1][1]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[1][2]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[1][3]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[1][4]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[1][5]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[1][6]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[1][7]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[1][8]"/></td>
            </tr>
            <tr>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[2][0]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[2][1]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[2][2]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[2][3]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[2][4]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[2][5]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[2][6]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[2][7]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[2][8]"/></td>
            </tr>
            <tr>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[3][0]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[3][1]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[3][2]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[3][3]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[3][4]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[3][5]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[3][6]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[3][7]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[3][8]"/></td>
            </tr>
            <tr>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[4][0]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[4][1]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[4][2]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[4][3]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[4][4]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[4][5]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[4][6]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[4][7]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[4][8]"/></td>
            </tr>
            <tr>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[5][0]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[5][1]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[5][2]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[5][3]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[5][4]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[5][5]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[5][6]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[5][7]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[5][8]"/></td>
            </tr>
            <tr>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[6][0]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[6][1]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[6][2]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[6][3]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[6][4]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[6][5]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[6][6]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[6][7]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[6][8]"/></td>
            </tr>
            <tr>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[7][0]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[7][1]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[7][2]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[7][3]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[7][4]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[7][5]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[7][6]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[7][7]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[7][8]"/></td>
            </tr>
            <tr>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[8][0]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[8][1]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[8][2]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[8][3]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[8][4]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[8][5]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[8][6]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[8][7]"/></td>
                <td><el-input-number :min=0 :max=9 :controls=false style="width: 40px;height: 100%;" v-model="data.map[8][8]"/></td>
            </tr>
        </table>
        <br>
        <div>{{data.msg}}</div>
        <br>
        <el-button style="display: block;margin:0 auto;" color="#626aef" plain @click="startSolve()">求解</el-button>
        <br>
        <el-button style="display: block;margin:0 auto;" color="#626aef" plain @click="reset()">清空</el-button>
        <br>
        <el-button style="display: block;margin:0 auto;" color="#626aef" plain @click="$router.push('Home')">返回主页</el-button>
    </div>
    
</template>
<script setup>
    import { ref } from 'vue'
    import axios from 'axios';
    const data = ref({
        //   msg: "请输入数独残局后点击“求解”按钮求解",
          msg: "服务器未开启，无法使用此功能...",
          map:[
            [0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0]]
        })
    // const startSolve = ()=>{
    //     // axios.get("http://localhost:8080/hello").then(response => (console.log(response.data)))
    //     axios.post('http://localhost:8080/solve',{msg: data.value.msg,map:data.value.map})
    //     .then((response) => {
    //     data.value.msg = response.data.msg;
    //     if(response.data.map!=null)
    //         data.value.map = response.data.map;
    // });}
    // const reset = ()=>{
    //     data.value.map=[
    //         [0,0,0,0,0,0,0,0,0],
    //         [0,0,0,0,0,0,0,0,0],
    //         [0,0,0,0,0,0,0,0,0],
    //         [0,0,0,0,0,0,0,0,0],
    //         [0,0,0,0,0,0,0,0,0],
    //         [0,0,0,0,0,0,0,0,0],
    //         [0,0,0,0,0,0,0,0,0],
    //         [0,0,0,0,0,0,0,0,0],
    //         [0,0,0,0,0,0,0,0,0]];
    //     data.value.msg="请输入数独残局后点击“求解”按钮求解";
    // }
</script>

<style>
/* *{
    padding: 0;
    margin: 0;
} */
:root, body {
    background: #FFF;
}

h1{
    text-align: center;
}
table{
    border-collapse: collapse;
    margin:0 auto;
}
td{
    width: 40px;
    height: 40px;
}
</style>