<template >
    <div style="text-align: center;">
        <h1>数独求解</h1>
        
        <div>{{data.msg}}</div>
        <br>
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
        <el-button style="display: block;margin:0 auto;" color="#626aef" plain @click="startSolve()">求解</el-button>
        <br>
        <el-button style="display: block;margin:0 auto;" color="#626aef" plain @click="reset()">清空</el-button>
        <br>
        <el-button style="display: block;margin:0 auto;" color="#626aef" plain @click="$router.push('Home')">返回主页</el-button>
    </div>
    <div id="flort"></div>
</template>
<script setup>
    import { ref, onMounted } from 'vue'
    import { ElNotification } from 'element-plus'
    import axios from 'axios';
    const solver = new SolveData();
    const offline = true;
    const data = ref({
          msg: "请输入数独残局后点击“求解”按钮求解",
        //   msg: "服务器未开启，无法使用此功能...",
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
    const startSolve = ()=>{
        if(offline){
            var t = solver.solve(data.value.map)
            if(t==null){
                data.value.msg="无解！"
            }
            else{
                data.value.msg="其中一种解为"
                data.value.map = t
            }
        }
        else{
            data.value.msg="求解中，请稍后..."
            // axios.get("http://localhost:8080/hello").then(response => (console.log(response.data)))
            axios.post('https://zbxzbx98.asia:18080/solve',{msg: data.value.msg,map:data.value.map})
            .then((response) => {
            data.value.msg = response.data.msg;
            if(response.data.map!=null)
                data.value.map = response.data.map;
            });
        }
    }

    const reset = ()=>{
        data.value.map=[
            [0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0]];
        // if(offline)
        //     return;
        data.value.msg="请输入数独残局后点击“求解”按钮求解";
    }
    onMounted(()=>{
        if(offline)
            ElNotification({
                title: '离线模式',
                message: "当前服务器为关闭状态，使用的数独求解功能将在本地运行！",
                position: 'bottom-right',
                type: 'warning',
                duration: 0,
            })
        })

</script>

<script>
class SolveData {
    constructor() {
        this.map = null;
        this.can = new Array(9).fill(null).map(() => new Array(9).fill(null).map(() => new Array(9).fill(0)));
    }

    solve(now) {
        this.map = now;
        for (let i = 0; i < 9; i++) {
            for (let j = 0; j < 9; j++) {
                const check = this.newCheckArray();
                this.checkLine(i, check);
                this.checkRow(j, check);
                this.checkBlock(i, j, check);
                this.can[i][j] = check;
                for (let k = 0; k < 9; k++) {
                    if (check[k] > 3)
                        return null;
                }
            }
        }
        const ans = this.find(0);
        return ans ? this.map : null;
    }

    find(num) {
        if (num > 80) {
            return true;
        }
        let end = false;
        const line = Math.floor(num / 9);
        const row = num % 9;
        if (this.map[line][row] > 0) {
            end = this.find(num + 1);
        } else {
            for (let i = 0; i < 9; i++) {
                if (this.can[line][row][i] === 0) {
                    if (this.change(line, row, i, 1)) {
                        this.map[line][row] = i + 1;
                        end = this.find(num + 1);
                        if (end)
                            return true;
                        this.map[line][row] = 0;
                    }
                    this.change(line, row, i, -1);
                }
            }
        }
        return end;
    }

    newCheckArray() {
        return [0, 0, 0, 0, 0, 0, 0, 0, 0];
    }

    checkLine(line, n) {
        for (let i = 0; i < 9; i++) {
            if (this.map[line][i] > 0)
                n[this.map[line][i] - 1]++;
        }
    }

    checkRow(row, n) {
        for (let i = 0; i < 9; i++) {
            if (this.map[i][row] > 0)
                n[this.map[i][row] - 1]++;
        }
    }

    checkBlock(line, row, n) {
        const x = Math.floor(line / 3);
        const y = Math.floor(row / 3);
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (this.map[3 * x + i][3 * y + j] > 0)
                    n[this.map[3 * x + i][3 * y + j] - 1]++;
            }
        }
    }

    change(line, row, num, changeNum) {
        let find = true;
        for (let i = 0; i < 9; i++) {
            this.can[line][i][num] += changeNum;
            if (this.can[line][i][num] > 3)
                find = false;
            this.can[i][row][num] += changeNum;
            if (this.can[i][row][num] > 3)
                find = false;
        }
        const x = Math.floor(line / 3);
        const y = Math.floor(row / 3);
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                this.can[3 * x + i][3 * y + j][num] += changeNum;
                if (this.can[3 * x + i][3 * y + j][num] > 3)
                    find = false;
            }
        }
        return find;
    }
}
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