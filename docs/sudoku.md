# 在线数独求解器 / Online Sudoku Solver

一个很小但完整可用的功能：输入 9×9 数独盘面（空格填 0），点击求解即可得到答案。

A small but fully working feature: enter a 9×9 Sudoku board (0 for empty cells) and solve it with one click.

---

## 中文

- 9×9 输入盘面，每个格子 0~9（0 表示空格）；
- **候选数剪枝**：求解前对每个空格统计所在行/列/宫已出现的数字，剔除不可用的候选；
- **DFS 回溯**：按顺序尝试候选数字，冲突时回退，找到解即返回；
- 无解时给出提示。

页面：`src/views/Solve.vue`

## English

- A 9×9 input grid; each cell accepts 0–9 (0 means empty);
- **Candidate pruning**: for every empty cell, candidates are pre-filtered by the digits already present in its row, column, and 3×3 block;
- **DFS backtracking**: tries candidates in order and backtracks on conflict until a solution is found;
- Reports when the board has no solution.

Page: `src/views/Solve.vue`
