// 添加全局变量存储游戏设置和排行榜数据
let gameSettings = {
    boardSize: 15,
    language: 'zh-CN'
};

let leaderboardData = [];
try {
    leaderboardData = JSON.parse(localStorage.getItem('gomokuLeaderboard') || '[]');
} catch (e) {
    console.error('Failed to parse leaderboard data:', e);
}

class Gomoku {
    constructor(mode = 'pvp', difficulty = 'normal') {
        this.boardSize = gameSettings.boardSize;
        this.board = [];
        this.currentPlayer = 'black';
        this.gameOver = false;
        this.startTime = null;
        this.moveHistory = []; // 记录每一步棋用于悔棋
        this.undoCount = 3; // 全局悔棋次数（总共3次）
        this.mode = mode; // 游戏模式: 'pvp'(玩家对战), 'pve'(人机对战)
        this.difficulty = difficulty; // 难度: 'easy', 'normal', 'hard'
        // 房间游戏相关属性
        this.isRoomGame = false;
        this.roomNumber = null;
        this.myColor = 'black';
        this.init();
    }

    init() {
        this.createBoard();
        this.renderBoard();
        this.bindEvents();
        this.startTime = new Date();
        this.updateUndoUI(); // 更新悔棋UI
    }

    createBoard() {
        for (let i = 0; i < this.boardSize; i++) {
            this.board[i] = [];
            for (let j = 0; j < this.boardSize; j++) {
                this.board[i][j] = null;
            }
        }
    }

    renderBoard() {
        const chessboard = document.getElementById('chessboard');
        chessboard.innerHTML = '';

        // 重设棋盘尺寸
        chessboard.style.width = `${(this.boardSize - 1) * 30 + 30}px`;
        chessboard.style.height = `${(this.boardSize - 1) * 30 + 30}px`;

        // 绘制棋盘线
        for (let i = 0; i < this.boardSize; i++) {
            // 垂直线
            const vLine = document.createElement('div');
            vLine.className = 'v-line';
            vLine.style.left = `${i * 30 + 15}px`;
            vLine.style.top = '15px';
            vLine.style.height = `${(this.boardSize - 1) * 30}px`;
            chessboard.appendChild(vLine);
            
            // 水平线
            const hLine = document.createElement('div');
            hLine.className = 'h-line';
            hLine.style.top = `${i * 30 + 15}px`;
            hLine.style.left = '15px';
            hLine.style.width = `${(this.boardSize - 1) * 30}px`;
            chessboard.appendChild(hLine);
        }

        // 绘制棋子
        for (let i = 0; i < this.boardSize; i++) {
            for (let j = 0; j < this.boardSize; j++) {
                if (this.board[i][j]) {
                    const piece = document.createElement('div');
                    piece.className = `piece ${this.board[i][j]}`;
                    piece.style.left = `${j * 30 + 1}px`;
                    piece.style.top = `${i * 30 + 1}px`;
                    chessboard.appendChild(piece);
                }
            }
        }

        // 添加预览棋子容器
        if (!document.getElementById('preview-piece')) {
            const previewPiece = document.createElement('div');
            previewPiece.id = 'preview-piece';
            previewPiece.className = 'piece preview';
            chessboard.appendChild(previewPiece);
        }
    }

    bindEvents() {
        const chessboard = document.getElementById('chessboard');
        
        // 鼠标移动事件 - 显示预览棋子
        chessboard.addEventListener('mousemove', (e) => {
            if (this.gameOver) return;
            
            // 人机对战模式下，电脑回合不显示预览
            if (this.mode === 'pve' && this.currentPlayer === 'white') {
                const previewPiece = document.getElementById('preview-piece');
                if (previewPiece) {
                    previewPiece.style.display = 'none';
                }
                return;
            }
            
            // 房间游戏模式下，不是自己回合不显示预览
            if (this.isRoomGame && this.currentPlayer !== this.myColor) {
                const previewPiece = document.getElementById('preview-piece');
                if (previewPiece) {
                    previewPiece.style.display = 'none';
                }
                return;
            }
            
            // 动态获取预览棋子元素
            let previewPiece = document.getElementById('preview-piece');
            if (!previewPiece) {
                // 如果预览棋子不存在，创建一个新的
                previewPiece = document.createElement('div');
                previewPiece.id = 'preview-piece';
                previewPiece.className = `piece preview ${this.currentPlayer}`;
                chessboard.appendChild(previewPiece);
            }
            
            const rect = chessboard.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // 计算最近的交叉点
            const col = Math.round((x - 15) / 30);
            const row = Math.round((y - 15) / 30);
            
            // 确保在棋盘范围内
            if (row >= 0 && row < this.boardSize && col >= 0 && col < this.boardSize) {
                // 更新预览棋子位置和颜色
                previewPiece.style.left = `${col * 30 + 1}px`;
                previewPiece.style.top = `${row * 30 + 1}px`;
                previewPiece.className = `piece preview ${this.currentPlayer}`;
                previewPiece.style.display = 'block';
            } else {
                previewPiece.style.display = 'none';
            }
        });
        
        // 鼠标离开事件 - 隐藏预览棋子
        chessboard.addEventListener('mouseleave', () => {
            const previewPiece = document.getElementById('preview-piece');
            if (previewPiece) {
                previewPiece.style.display = 'none';
            }
        });
        
        // 点击事件 - 下子
        chessboard.addEventListener('click', (e) => {
            if (this.gameOver) return;
            
            const rect = chessboard.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // 计算最近的交叉点
            const col = Math.round((x - 15) / 30);
            const row = Math.round((y - 15) / 30);
            
            // 确保在棋盘范围内且该位置为空
            if (row >= 0 && row < this.boardSize && col >= 0 && col < this.boardSize) {
                if (this.board[row][col] === null) {
                    this.placePiece(row, col);
                    
                    // 如果是人机对战且游戏未结束，则电脑下棋
                    if (this.mode === 'pve' && !this.gameOver && this.currentPlayer === 'white') {
                        setTimeout(() => this.aiMove(), 500);
                    }
                }
            }
        });

        document.getElementById('reset-btn').addEventListener('click', () => {
            this.resetGame();
        });

        document.getElementById('play-again').addEventListener('click', () => {
            this.resetGame();
        });

        // 添加返回主菜单按钮事件
        document.getElementById('back-to-menu').addEventListener('click', () => {
            document.getElementById('game-container').style.display = 'none';
            document.getElementById('main-menu').style.display = 'flex';
        });
        
        // 添加悔棋按钮事件
        document.getElementById('undo-btn').addEventListener('click', () => {
            this.undoMove();
        });
    }

    placePiece(row, col) {
        // 只有轮到自己的时候才能落子（房间游戏）
        if (this.isRoomGame && this.currentPlayer !== this.myColor) {
            return;
        }
        
        // 记录这步棋用于悔棋
        this.moveHistory.push({row, col, player: this.currentPlayer});
        
        this.board[row][col] = this.currentPlayer;
        this.renderBoard();
        
        // 添加行动信息到列表
        const movesList = document.getElementById('moves-list');
        const moveItem = document.createElement('li');
        moveItem.textContent = `${this.currentPlayer === 'black' ? '黑棋' : '白棋'}: (${row+1}, ${col+1})`;
        movesList.appendChild(moveItem);
        movesList.scrollTop = movesList.scrollHeight; // 自动滚动到底部
        
        // 检查是否获胜
        if (this.checkWin(row, col)) {
            const endTime = new Date();
            const gameTime = Math.round((endTime - this.startTime) / 1000); // 游戏时间（秒）
            
            // 更新房间游戏状态
            if (this.isRoomGame) {
                const roomData = {
                    createdBy: new Date().getTime(),
                    status: 'playing',
                    board: this.board,
                    currentPlayer: this.currentPlayer,
                    gameOver: true,
                    moveHistory: this.moveHistory
                };
                try {
            localStorage.setItem(`gomoku_room_${this.roomNumber}`, JSON.stringify(roomData));
        } catch (e) {
            console.error('Failed to update room data:', e);
        }
            }
            
            this.endGame(`${this.currentPlayer === 'black' ? (gameSettings.language === 'zh-CN' ? '黑棋' : 'Black') : (gameSettings.language === 'zh-CN' ? '白棋' : 'White')} ${(gameSettings.language === 'zh-CN' ? '获胜！' : 'wins!')}`, gameTime);
            return;
        }
        
        // 检查是否平局
        if (this.checkDraw()) {
            // 更新房间游戏状态
            if (this.isRoomGame) {
                const roomData = {
                    createdBy: new Date().getTime(),
                    status: 'playing',
                    board: this.board,
                    currentPlayer: this.currentPlayer,
                    gameOver: true,
                    moveHistory: this.moveHistory
                };
                localStorage.setItem(`gomoku_room_${this.roomNumber}`, JSON.stringify(roomData));
            }
            
            this.endGame(gameSettings.language === 'zh-CN' ? '平局！' : 'It\'s a draw!', null);
            return;
        }
        
        // 切换玩家
        this.switchPlayer();
        
        // 更新房间游戏状态
        if (this.isRoomGame) {
            const roomData = {
                createdBy: new Date().getTime(),
                status: 'playing',
                board: this.board,
                currentPlayer: this.currentPlayer,
                gameOver: false,
                moveHistory: this.moveHistory
            };
            localStorage.setItem(`gomoku_room_${this.roomNumber}`, JSON.stringify(roomData));
        }
        
        this.updateUndoUI(); // 更新悔棋UI
    }

    // 电脑AI下棋
    aiMove() {
        if (this.gameOver) return;
        
        let row, col;
        
        switch(this.difficulty) {
            case 'easy':
                [row, col] = this.getEasyAIMove();
                break;
            case 'normal':
                [row, col] = this.getNormalAIMove();
                break;
            case 'hard':
                [row, col] = this.getHardAIMove();
                break;
            default:
                [row, col] = this.getNormalAIMove();
        }
        
        this.placePiece(row, col);
    }

    // 简单AI：随机下棋
    getEasyAIMove() {
        const emptyCells = [];
        for (let i = 0; i < this.boardSize; i++) {
            for (let j = 0; j < this.boardSize; j++) {
                if (this.board[i][j] === null) {
                    emptyCells.push([i, j]);
                }
            }
        }
        
        if (emptyCells.length > 0) {
            const randomIndex = Math.floor(Math.random() * emptyCells.length);
            return emptyCells[randomIndex];
        }
        
        return [Math.floor(this.boardSize/2), Math.floor(this.boardSize/2)];
    }

    // 评估位置价值的辅助函数
    evaluatePosition(row, col, player) {
        const opponent = player === 'black' ? 'white' : 'black';
        let score = 0;
        
        // 四个方向：水平、垂直、主对角线、副对角线
        const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
        
        for (let [dx, dy] of directions) {
            // 评估当前方向上的连续棋子
            let playerCount = 0;
            let opponentCount = 0;
            let emptyCount = 0;
            let blocked = 0;
            
            // 检查当前位置前后的棋子
            for (let i = -4; i <= 4; i++) {
                const newRow = row + dx * i;
                const newCol = col + dy * i;
                
                // 如果超出棋盘范围，视为被阻挡
                if (newRow < 0 || newRow >= this.boardSize || newCol < 0 || newCol >= this.boardSize) {
                    blocked++;
                    continue;
                }
                
                const cell = this.board[newRow][newCol];
                if (cell === player) {
                    playerCount++;
                } else if (cell === opponent) {
                    opponentCount++;
                    playerCount = 0; // 重置连续计数
                } else {
                    emptyCount++;
                }
                
                // 计算连续的棋子数并给予相应的分数
                if (playerCount === 4) {
                    score += 10000; // 能赢的位置
                } else if (playerCount === 3 && emptyCount >= 1 && blocked < 2) {
                    score += 1000; // 活三
                } else if (playerCount === 3 && blocked === 1) {
                    score += 100; // 冲四
                } else if (playerCount === 2 && emptyCount >= 2 && blocked < 2) {
                    score += 100; // 活二
                } else if (playerCount === 2 && blocked === 1) {
                    score += 10; // 眠二
                }
                
                // 评估对手的威胁
                if (opponentCount === 4) {
                    score += 5000; // 必须防守的位置
                } else if (opponentCount === 3 && emptyCount >= 1 && blocked < 2) {
                    score += 500; // 对手的活三
                } else if (opponentCount === 3 && blocked === 1) {
                    score += 50; // 对手的冲四
                } else if (opponentCount === 2 && emptyCount >= 2 && blocked < 2) {
                    score += 50; // 对手的活二
                }
            }
        }
        
        // 棋盘中心位置有额外价值（开局阶段）
        const centerDistance = Math.abs(row - this.boardSize / 2) + Math.abs(col - this.boardSize / 2);
        score += (10 - centerDistance) * 2;
        
        return score;
    }

    // 普通AI：有一定策略的下棋
    getNormalAIMove() {
        // 先尝试找到能赢的位置
        for (let i = 0; i < this.boardSize; i++) {
            for (let j = 0; j < this.boardSize; j++) {
                if (this.board[i][j] === null) {
                    this.board[i][j] = 'white';
                    if (this.checkWin(i, j)) {
                        this.board[i][j] = null;
                        return [i, j];
                    }
                    this.board[i][j] = null;
                }
            }
        }
        
        // 阻止玩家获胜
        for (let i = 0; i < this.boardSize; i++) {
            for (let j = 0; j < this.boardSize; j++) {
                if (this.board[i][j] === null) {
                    this.board[i][j] = 'black';
                    if (this.checkWin(i, j)) {
                        this.board[i][j] = null;
                        return [i, j];
                    }
                    this.board[i][j] = null;
                }
            }
        }
        
        // 尝试找到能形成活三或冲四的位置
        let bestScore = -1;
        let bestMove = null;
        
        for (let i = 0; i < this.boardSize; i++) {
            for (let j = 0; j < this.boardSize; j++) {
                if (this.board[i][j] === null) {
                    // 评估当前位置
                    this.board[i][j] = 'white';
                    let score = 0;
                    
                    // 检查是否能形成活三或冲四
                    if (this.checkPotentialWin(i, j, 'white')) {
                        score += 500;
                    }
                    
                    this.board[i][j] = null;
                    
                    // 评估对手的威胁
                    this.board[i][j] = 'black';
                    if (this.checkPotentialWin(i, j, 'black')) {
                        score += 300;
                    }
                    
                    this.board[i][j] = null;
                    
                    if (score > bestScore) {
                        bestScore = score;
                        bestMove = [i, j];
                    }
                }
            }
        }
        
        if (bestMove) {
            return bestMove;
        }
        
        // 如果没有好的策略，使用简单AI逻辑
        return this.getEasyAIMove();
    }
    
    // 检查是否有潜在的获胜机会（活三、冲四等）
    checkPotentialWin(row, col, player) {
        const opponent = player === 'black' ? 'white' : 'black';
        const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
        
        for (let [dx, dy] of directions) {
            // 检查活三：三个连续棋子，两端有空位
            let count = 0;
            let leftEmpty = false;
            let rightEmpty = false;
            
            // 检查当前方向
            for (let i = -2; i <= 2; i++) {
                const newRow = row + dx * i;
                const newCol = col + dy * i;
                
                if (newRow < 0 || newRow >= this.boardSize || newCol < 0 || newCol >= this.boardSize) {
                    continue;
                }
                
                const cell = this.board[newRow][newCol];
                if (cell === player) {
                    count++;
                }
            }
            
            // 检查两端是否有空位
            const leftRow = row - dx * 3;
            const leftCol = col - dy * 3;
            if (leftRow >= 0 && leftRow < this.boardSize && leftCol >= 0 && leftCol < this.boardSize) {
                if (this.board[leftRow][leftCol] === null) {
                    leftEmpty = true;
                }
            }
            
            const rightRow = row + dx * 3;
            const rightCol = col + dy * 3;
            if (rightRow >= 0 && rightRow < this.boardSize && rightCol >= 0 && rightCol < this.boardSize) {
                if (this.board[rightRow][rightCol] === null) {
                    rightEmpty = true;
                }
            }
            
            if (count === 3 && (leftEmpty || rightEmpty)) {
                return true;
            }
            
            // 检查冲四：四个连续棋子，一端被阻挡，一端有空位
            count = 0;
            let blocked = 0;
            let empty = false;
            
            for (let i = -3; i <= 3; i++) {
                const newRow = row + dx * i;
                const newCol = col + dy * i;
                
                if (newRow < 0 || newRow >= this.boardSize || newCol < 0 || newCol >= this.boardSize) {
                    blocked++;
                    continue;
                }
                
                const cell = this.board[newRow][newCol];
                if (cell === player) {
                    count++;
                } else if (cell === opponent) {
                    blocked++;
                } else {
                    empty = true;
                }
            }
            
            if (count === 4 && blocked < 2 && empty) {
                return true;
            }
        }
        
        return false;
    }

    // 困难AI：更高级的策略
    getHardAIMove() {
        let bestScore = -Infinity;
        let bestMoves = [];
        
        // 评估所有空位并找到分数最高的位置
        for (let i = 0; i < this.boardSize; i++) {
            for (let j = 0; j < this.boardSize; j++) {
                if (this.board[i][j] === null) {
                    // 先检查是否能直接赢
                    this.board[i][j] = 'white';
                    if (this.checkWin(i, j)) {
                        this.board[i][j] = null;
                        return [i, j];
                    }
                    this.board[i][j] = null;
                    
                    // 再检查是否需要防守
                    this.board[i][j] = 'black';
                    if (this.checkWin(i, j)) {
                        this.board[i][j] = null;
                        return [i, j];
                    }
                    this.board[i][j] = null;
                    
                    // 评估当前位置的价值
                    const score = this.evaluatePosition(i, j, 'white');
                    
                    if (score > bestScore) {
                        bestScore = score;
                        bestMoves = [[i, j]];
                    } else if (score === bestScore) {
                        bestMoves.push([i, j]);
                    }
                }
            }
        }
        
        // 如果有多个分数相同的最佳位置，随机选择一个
        if (bestMoves.length > 0) {
            const randomIndex = Math.floor(Math.random() * bestMoves.length);
            return bestMoves[randomIndex];
        }
        
        //  fallback到简单AI
        return this.getEasyAIMove();
    }

    switchPlayer() {
        this.currentPlayer = this.currentPlayer === 'black' ? 'white' : 'black';
        document.getElementById('player').textContent = this.currentPlayer === 'black' ? 
            (gameSettings.language === 'zh-CN' ? '黑棋' : 'Black') : 
            (gameSettings.language === 'zh-CN' ? '白棋' : 'White');
        
        // 人机对战模式下，切换到电脑回合时隐藏预览棋子
        if (this.mode === 'pve' && this.currentPlayer === 'white') {
            const previewPiece = document.getElementById('preview-piece');
            if (previewPiece) {
                previewPiece.style.display = 'none';
            }
        }
    }

    checkWin(row, col) {
        const directions = [
            [0, 1],   // 水平
            [1, 0],   // 垂直
            [1, 1],   // 主对角线
            [1, -1]   // 副对角线
        ];

        for (let [dx, dy] of directions) {
            let count = 1;

            // 正方向检查
            for (let i = 1; i <= 4; i++) {
                const newRow = row + dx * i;
                const newCol = col + dy * i;
                
                if (
                    newRow >= 0 && 
                    newRow < this.boardSize && 
                    newCol >= 0 && 
                    newCol < this.boardSize && 
                    this.board[newRow][newCol] === this.currentPlayer
                ) {
                    count++;
                } else {
                    break;
                }
            }

            // 反方向检查
            for (let i = 1; i <= 4; i++) {
                const newRow = row - dx * i;
                const newCol = col - dy * i;
                
                if (
                    newRow >= 0 && 
                    newRow < this.boardSize && 
                    newCol >= 0 && 
                    newCol < this.boardSize && 
                    this.board[newRow][newCol] === this.currentPlayer
                ) {
                    count++;
                } else {
                    break;
                }
            }

            if (count >= 5) {
                return true;
            }
        }

        return false;
    }

    checkDraw() {
        for (let i = 0; i < this.boardSize; i++) {
            for (let j = 0; j < this.boardSize; j++) {
                if (this.board[i][j] === null) {
                    return false;
                }
            }
        }
        return true;
    }

    endGame(message, gameTime) {
        this.gameOver = true;
        document.getElementById('winner-text').textContent = message;
        document.getElementById('winner-message').classList.add('show');
        
        // 如果有获胜者，更新排行榜
        if (gameTime !== null && (message.includes('获胜') || message.includes('wins'))) {
            const winner = this.currentPlayer;
            updateLeaderboard(winner, gameTime);
        }
    }

    // 悔棋功能
    undoMove() {
        // 检查游戏是否结束或没有可悔的棋
        if (this.gameOver || this.moveHistory.length === 0) return;
        
        // 检查是否还有悔棋次数
        if (this.undoCount <= 0) {
            alert(gameSettings.language === 'zh-CN' ? '您已经没有悔棋次数了！' : 'No more undo moves available!');
            return;
        }
        
        // 只有轮到自己的时候才能悔棋（房间游戏）
        if (this.isRoomGame && this.currentPlayer !== this.myColor) {
            return;
        }
        
        // 撤销当前玩家的上一步
        const lastMove = this.moveHistory.pop();
        this.board[lastMove.row][lastMove.col] = null;
        
        // 处理不同游戏模式的悔棋逻辑
        if (this.mode === 'pve' && this.moveHistory.length > 0) {
            // 人机对战模式，额外撤销电脑的一步
            const computerMove = this.moveHistory.pop();
            this.board[computerMove.row][computerMove.col] = null;
        } else if (this.isRoomGame && this.moveHistory.length > 0) {
            // 房间游戏模式，额外撤销对方的一步
            const opponentMove = this.moveHistory.pop();
            this.board[opponentMove.row][opponentMove.col] = null;
            // 保持当前玩家不变，因为悔棋了两步
        } else {
            // 普通玩家对战模式，只撤销一步
            this.switchPlayer();
        }
        
        // 悔棋次数减1
        this.undoCount--;
        
        // 更新UI
        this.renderBoard();
        
        // 移除行动信息
        const movesList = document.getElementById('moves-list');
        if (this.mode === 'pve' || this.isRoomGame) {
            // 人机对战或房间游戏，移除最后两条记录
            if (movesList.lastChild) movesList.removeChild(movesList.lastChild);
            if (movesList.lastChild) movesList.removeChild(movesList.lastChild);
        } else {
            // 普通玩家对战，移除最后一条记录
            if (movesList.lastChild) movesList.removeChild(movesList.lastChild);
        }
        
        this.updateUndoUI();
        document.getElementById('player').textContent = this.currentPlayer === 'black' ? 
            (gameSettings.language === 'zh-CN' ? '黑棋' : 'Black') : 
            (gameSettings.language === 'zh-CN' ? '白棋' : 'White');
        
        // 更新房间游戏数据
        if (this.isRoomGame) {
            const roomData = {
                createdBy: new Date().getTime(),
                status: 'playing',
                board: this.board,
                currentPlayer: this.currentPlayer,
                gameOver: false,
                moveHistory: this.moveHistory
            };
            localStorage.setItem(`gomoku_room_${this.roomNumber}`, JSON.stringify(roomData));
        }
    }

    // 更新悔棋UI
    updateUndoUI() {
        const undoBtn = document.getElementById('undo-btn');
        
        if (undoBtn) {
            // 更新悔棋按钮文本，显示已用次数/总次数
            const usedUndos = 3 - this.undoCount;
            undoBtn.textContent = `悔棋(${usedUndos}/3)`;
            undoBtn.disabled = this.undoCount <= 0;
        }
    }

    resetGame() {
        this.board = [];
        this.currentPlayer = 'black';
        this.gameOver = false;
        this.moveHistory = [];
        this.undoCount = 3; // 重置悔棋次数
        document.getElementById('player').textContent = gameSettings.language === 'zh-CN' ? '黑棋' : 'Black';
        document.getElementById('winner-message').classList.remove('show');
        document.getElementById('moves-list').innerHTML = ''; // 清空行动信息
        this.init();
        
        // 更新房间游戏数据
        if (this.isRoomGame) {
            const roomData = {
                createdBy: new Date().getTime(),
                status: 'playing',
                board: this.board,
                currentPlayer: this.currentPlayer,
                gameOver: false,
                moveHistory: this.moveHistory
            };
            localStorage.setItem(`gomoku_room_${this.roomNumber}`, JSON.stringify(roomData));
        }
    }
}

// 初始化游戏
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    renderLeaderboard();
    
    // 绑定游戏模式选择事件
    document.getElementById('pve-btn').addEventListener('click', () => {
        // 切换难度选项的显示状态
        const difficultyOptions = document.getElementById('difficulty-options');
        const pvpOptions = document.getElementById('pvp-options');
        difficultyOptions.style.display = difficultyOptions.style.display === 'none' ? 'flex' : 'none';
        pvpOptions.style.display = 'none';
    });
    
    document.getElementById('pvp-btn').addEventListener('click', () => {
        // 切换对战方式选项的显示状态
        const pvpOptions = document.getElementById('pvp-options');
        const difficultyOptions = document.getElementById('difficulty-options');
        pvpOptions.style.display = pvpOptions.style.display === 'none' ? 'flex' : 'none';
        difficultyOptions.style.display = 'none';
    });
    
    // 绑定难度选择事件
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const difficulty = btn.dataset.difficulty;
            startGameWithMode('pve', difficulty);
        });
    });
    
    // 绑定对战方式选择事件
    document.querySelectorAll('.pvp-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const pvpMode = btn.dataset.mode;
            if (pvpMode === 'local') {
                startGameWithMode('pvp', 'local');
            } else if (pvpMode === 'room') {
                // 显示房间号输入界面
                document.getElementById('game-mode-selector').style.display = 'none';
                document.getElementById('room-input').style.display = 'flex';
            }
        });
    });
    
    // 房间号输入界面事件
    document.getElementById('create-room-btn').addEventListener('click', () => {
        const roomNumber = document.getElementById('room-number').value;
        if (validateRoomNumber(roomNumber)) {
            createRoom(roomNumber);
        } else {
            alert('请输入有效的4位数字房间号！');
        }
    });
    
    document.getElementById('join-room-btn').addEventListener('click', () => {
        const roomNumber = document.getElementById('room-number').value;
        if (validateRoomNumber(roomNumber)) {
            joinRoom(roomNumber);
        } else {
            alert('请输入有效的4位数字房间号！');
        }
    });
    
    document.getElementById('back-to-pvp-menu').addEventListener('click', () => {
        document.getElementById('room-input').style.display = 'none';
        document.getElementById('game-mode-selector').style.display = 'flex';
    });
    
    // 准备按钮事件
    document.getElementById('ready-btn').addEventListener('click', () => {
        if (window.currentRoomNumber && window.currentPlayerType) {
            markPlayerReady(window.currentRoomNumber, window.currentPlayerType);
        }
    });
    
    // 取消房间按钮事件
    document.getElementById('cancel-room-btn').addEventListener('click', () => {
        if (window.currentRoomNumber) {
            cancelRoom(window.currentRoomNumber, window.currentPlayerType);
        }
    });
    
    // 房间号输入验证
    document.getElementById('room-number').addEventListener('input', (e) => {
        // 只允许输入数字
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
    });
    
    // 返回按钮事件
    document.getElementById('back-to-game-menu').addEventListener('click', () => {
        document.getElementById('game-mode-selector').style.display = 'none';
        document.getElementById('main-menu').style.display = 'flex';
    });
    
    document.getElementById('back-from-difficulty').addEventListener('click', () => {
        document.getElementById('difficulty-selector').style.display = 'none';
        document.getElementById('game-mode-selector').style.display = 'flex';
    });
    
    document.getElementById('back-from-pvp').addEventListener('click', () => {
        document.getElementById('pvp-selector').style.display = 'none';
        document.getElementById('game-mode-selector').style.display = 'flex';
    });
});

// 主菜单功能函数
function startGame() {
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('game-mode-selector').style.display = 'flex';
}

// 开始指定模式的游戏
function startGameWithMode(mode, option) {
    document.getElementById('game-mode-selector').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
    
    // 创建新游戏实例
    new Gomoku(mode, option);
}

// 验证房间号
function validateRoomNumber(roomNumber) {
    return /^\d{4}$/.test(roomNumber);
}

// 创建房间
function createRoom(roomNumber) {
    // 清除之前的游戏数据
    localStorage.removeItem(`gomoku_room_${roomNumber}`);
    
    // 存储房间信息
    const roomData = {
        createdBy: new Date().getTime(),
        status: 'waiting',
        players: {
            player1: { color: null, ready: false, joined: true },
            player2: { color: null, ready: false, joined: false }
        },
        board: null,
        currentPlayer: null,
        gameOver: false,
        moveHistory: [],
        gameStarted: false
    };
    try {
        localStorage.setItem(`gomoku_room_${roomNumber}`, JSON.stringify(roomData));
    } catch (e) {
        console.error('Failed to create room:', e);
        alert('无法创建房间，请检查浏览器存储权限！');
        return;
    }
    
    // 进入等待界面
    showWaitingRoom(roomNumber, 'player1');
}

// 加入房间
function joinRoom(roomNumber) {
    const roomData = localStorage.getItem(`gomoku_room_${roomNumber}`);
    if (roomData) {
        const parsedData = JSON.parse(roomData);
        if (parsedData.status === 'waiting') {
            // 更新房间状态和玩家信息
            parsedData.status = 'ready';
            parsedData.players.player2.joined = true;
            try {
        localStorage.setItem(`gomoku_room_${roomNumber}`, JSON.stringify(parsedData));
    } catch (e) {
        console.error('Failed to join room:', e);
        alert('无法加入房间，请检查浏览器存储权限！');
        return;
    }
            
            // 进入等待界面
            showWaitingRoom(roomNumber, 'player2');
        } else {
            alert('房间已满或不存在！');
        }
    } else {
        alert('房间不存在！');
    }
}

// 显示等待房间界面
function showWaitingRoom(roomNumber, playerType) {
    // 隐藏其他界面
    document.getElementById('room-input').style.display = 'none';
    document.getElementById('game-container').style.display = 'none';
    
    // 显示等待界面
    document.getElementById('waiting-room').style.display = 'flex';
    document.getElementById('waiting-room-number').textContent = roomNumber;
    
    // 保存当前房间号和玩家类型到全局变量
    window.currentRoomNumber = roomNumber;
    window.currentPlayerType = playerType;
    
    // 显示准备按钮
    document.getElementById('ready-btn').style.display = 'block';
    
    // 更新玩家状态
    updateWaitingRoomUI();
    
    // 开始定期检查房间状态
    window.waitingCheckInterval = setInterval(() => {
        checkRoomStatus(roomNumber, playerType);
    }, 500);
}

// 更新等待房间UI
function updateWaitingRoomUI() {
    const roomNumber = window.currentRoomNumber;
    const playerType = window.currentPlayerType;
    
    // 获取房间数据
    const roomData = localStorage.getItem(`gomoku_room_${roomNumber}`);
    if (roomData) {
        const parsedData = JSON.parse(roomData);
        const readyBtn = document.getElementById('ready-btn');
        
        // 更新玩家2状态
        if (parsedData.players.player2.joined) {
            document.getElementById('opponent-readiness').textContent = parsedData.players.player2.ready ? 
                (gameSettings.language === 'zh-CN' ? '已准备' : 'Ready') : 
                (gameSettings.language === 'zh-CN' ? '已加入' : 'Joined');
            document.getElementById('opponent-readiness').className = parsedData.players.player2.ready ? 'ready' : 'joined';
            document.getElementById('waiting-info').textContent = gameSettings.language === 'zh-CN' ? '对手已加入，等待双方准备...' : 'Opponent joined, waiting for both players to ready...';
        } else {
            document.getElementById('opponent-readiness').textContent = gameSettings.language === 'zh-CN' ? '未加入' : 'Not joined';
            document.getElementById('opponent-readiness').className = 'not-ready';
            document.getElementById('waiting-info').textContent = gameSettings.language === 'zh-CN' ? '等待对手加入...' : 'Waiting for opponent to join...';
        }
        
        // 更新准备状态
        if (parsedData.players.player1.ready) {
            document.getElementById('your-readiness').textContent = gameSettings.language === 'zh-CN' ? '已准备' : 'Ready';
            document.getElementById('your-readiness').className = 'ready';
            if (playerType === 'player1' && readyBtn) {
                readyBtn.textContent = gameSettings.language === 'zh-CN' ? '取消准备' : 'Cancel Ready';
            }
        } else {
            document.getElementById('your-readiness').textContent = gameSettings.language === 'zh-CN' ? '未准备' : 'Not ready';
            document.getElementById('your-readiness').className = 'not-ready';
            if (playerType === 'player1' && readyBtn) {
                readyBtn.textContent = gameSettings.language === 'zh-CN' ? '准备' : 'Ready';
            }
        }
        
        if (parsedData.players.player2.ready) {
            document.getElementById('opponent-readiness').textContent = gameSettings.language === 'zh-CN' ? '已准备' : 'Ready';
            document.getElementById('opponent-readiness').className = 'ready';
        }
        
        // 更新准备按钮显示
        if (parsedData.players.player2.joined && readyBtn) {
            readyBtn.style.display = 'inline-block';
            readyBtn.disabled = false;
        }
    }
}

// 检查房间状态
function checkRoomStatus(roomNumber, playerType) {
    const roomData = localStorage.getItem(`gomoku_room_${roomNumber}`);
    if (roomData) {
        const parsedData = JSON.parse(roomData);
        
        // 更新UI
        updateWaitingRoomUI();
        
        // 检查是否两个玩家都已准备
        if (parsedData.players.player1.ready && parsedData.players.player2.ready && !parsedData.gameStarted) {
            // 随机分配黑棋白棋
            const colors = ['black', 'white'];
            const randomIndex = Math.floor(Math.random() * 2);
            parsedData.players.player1.color = colors[randomIndex];
            parsedData.players.player2.color = colors[1 - randomIndex];
            parsedData.currentPlayer = 'black'; // 黑棋先手
            parsedData.gameStarted = true;
            
            // 更新房间数据
            localStorage.setItem(`gomoku_room_${roomNumber}`, JSON.stringify(parsedData));
            
            // 清除检查间隔
            clearInterval(window.waitingCheckInterval);
            
            // 开始游戏
            startRoomGame(roomNumber, parsedData.players[playerType].color);
        } else if (!parsedData.gameStarted) {
            // 检查游戏是否开始（可能由另一方触发）
            if (parsedData.gameStarted) {
                clearInterval(window.waitingCheckInterval);
                startRoomGame(roomNumber, parsedData.players[playerType].color);
            }
        }
    } else {
        // 房间已被删除（创建者取消）
        alert(gameSettings.language === 'zh-CN' ? '房间已被创建者取消！' : 'Room has been canceled by the creator!');
        cancelRoom(roomNumber, playerType);
    }
}

// 标记玩家已准备
function markPlayerReady(roomNumber, playerType) {
    const roomData = localStorage.getItem(`gomoku_room_${roomNumber}`);
    if (roomData) {
        const parsedData = JSON.parse(roomData);
        const readyBtn = document.getElementById('ready-btn');
        
        // 切换准备状态
        const currentReadyState = parsedData.players[playerType].ready;
        parsedData.players[playerType].ready = !currentReadyState;
        localStorage.setItem(`gomoku_room_${roomNumber}`, JSON.stringify(parsedData));
        
        // 更新UI
        if (playerType === 'player1') {
            if (parsedData.players[playerType].ready) {
                document.getElementById('your-readiness').textContent = gameSettings.language === 'zh-CN' ? '已准备' : 'Ready';
                document.getElementById('your-readiness').className = 'ready';
                readyBtn.textContent = gameSettings.language === 'zh-CN' ? '取消准备' : 'Cancel Ready';
            } else {
                document.getElementById('your-readiness').textContent = gameSettings.language === 'zh-CN' ? '未准备' : 'Not ready';
                document.getElementById('your-readiness').className = 'not-ready';
                readyBtn.textContent = gameSettings.language === 'zh-CN' ? '准备' : 'Ready';
            }
        } else {
            if (parsedData.players[playerType].ready) {
                document.getElementById('opponent-readiness').textContent = gameSettings.language === 'zh-CN' ? '已准备' : 'Ready';
                document.getElementById('opponent-readiness').className = 'ready';
            } else {
                document.getElementById('opponent-readiness').textContent = gameSettings.language === 'zh-CN' ? '未准备' : 'Not ready';
                document.getElementById('opponent-readiness').className = 'not-ready';
            }
        }
        
        // 启用按钮
        readyBtn.disabled = false;
        
        // 检查双方是否都已准备
        if (parsedData.players.player1.ready && parsedData.players.player2.ready && !parsedData.gameStarted) {
            // 随机分配黑棋白棋
            const colors = ['black', 'white'];
            const randomIndex = Math.floor(Math.random() * 2);
            parsedData.players.player1.color = colors[randomIndex];
            parsedData.players.player2.color = colors[1 - randomIndex];
            parsedData.currentPlayer = 'black'; // 黑棋先手
            parsedData.gameStarted = true;
            
            // 初始化棋盘
            parsedData.board = Array.from({ length: 15 }, () => Array.from({ length: 15 }, () => null));
            
            // 更新房间数据
            localStorage.setItem(`gomoku_room_${roomNumber}`, JSON.stringify(parsedData));
        }
    }
}

// 取消房间
function cancelRoom(roomNumber, playerType) {
    // 清除检查间隔
    if (window.waitingCheckInterval) {
        clearInterval(window.waitingCheckInterval);
        window.waitingCheckInterval = null;
    }
    
    // 删除房间数据（如果是创建者）
    const roomData = localStorage.getItem(`gomoku_room_${roomNumber}`);
    if (roomData) {
        const parsedData = JSON.parse(roomData);
        if (playerType === 'player1') {
            localStorage.removeItem(`gomoku_room_${roomNumber}`);
        }
    }
    
    // 重置全局变量
    window.currentRoomNumber = null;
    window.currentPlayerType = null;
    
    // 返回房间号输入界面
    document.getElementById('waiting-room').style.display = 'none';
    document.getElementById('room-input').style.display = 'flex';
}

// 开始房间游戏
function startRoomGame(roomNumber, playerColor) {
    // 清除检查间隔
    if (window.waitingCheckInterval) {
        clearInterval(window.waitingCheckInterval);
        window.waitingCheckInterval = null;
    }
    
    // 隐藏等待界面
    document.getElementById('waiting-room').style.display = 'none';
    document.getElementById('room-input').style.display = 'none';
    
    // 显示游戏界面
    document.getElementById('game-container').style.display = 'block';
    
    // 显示房间信息
    document.getElementById('room-info').style.display = 'block';
    document.getElementById('current-room').textContent = roomNumber;
    
    // 创建游戏实例
    const game = new Gomoku('pvp', 'room');
    game.currentPlayer = playerColor;
    game.roomNumber = roomNumber;
    game.isRoomGame = true;
    game.myColor = playerColor;
    
    // 更新玩家显示
    document.getElementById('player').textContent = playerColor === 'black' ? 
        (gameSettings.language === 'zh-CN' ? '黑棋' : 'Black') : 
        (gameSettings.language === 'zh-CN' ? '白棋' : 'White');
    
    // 设置房间游戏的事件监听
    setupRoomGameEvents(game);
}

// 设置房间游戏的事件监听
function setupRoomGameEvents(game) {
    // 定期检查对方的落子
    const checkInterval = setInterval(() => {
        if (game.gameOver) {
            clearInterval(checkInterval);
            return;
        }
        
        // 只在对方回合时检查
        if (game.currentPlayer !== game.myColor) {
            const roomData = localStorage.getItem(`gomoku_room_${game.roomNumber}`);
            if (roomData) {
                const parsedData = JSON.parse(roomData);
                // 检查是否有新的落子
                if (parsedData.board && parsedData.currentPlayer === game.myColor) {
                    // 更新游戏状态
                    game.board = parsedData.board;
                    game.currentPlayer = parsedData.currentPlayer;
                    game.moveHistory = parsedData.moveHistory;
                    
                    // 重新绘制棋盘
                    game.renderBoard();
                    
                    // 更新UI
                    document.getElementById('player').textContent = game.currentPlayer === 'black' ? 
                        (gameSettings.language === 'zh-CN' ? '黑棋' : 'Black') : 
                        (gameSettings.language === 'zh-CN' ? '白棋' : 'White');
                    game.updateUndoUI();
                    
                    // 检查游戏是否结束
                    if (parsedData.gameOver) {
                        game.gameOver = true;
                        const winner = parsedData.currentPlayer === 'black' ? 'white' : 'black';
                        game.endGame(`${winner === 'black' ? (gameSettings.language === 'zh-CN' ? '黑棋' : 'Black') : (gameSettings.language === 'zh-CN' ? '白棋' : 'White')} ${(gameSettings.language === 'zh-CN' ? '获胜！' : 'wins!')}`, null);
                        clearInterval(checkInterval);
                    }
                }
            }
        }
    }, 500);
}

function showLeaderboard() {
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('leaderboard').style.display = 'flex';
    renderLeaderboard();
}

function showSettings() {
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('settings').style.display = 'flex';
    
    // 加载当前设置
    document.getElementById('board-size').value = gameSettings.boardSize;
    document.getElementById('language').value = gameSettings.language;
}

function exitGame() {
    if (confirm(gameSettings.language === 'zh-CN' ? '确定要退出游戏吗？' : 'Are you sure you want to exit the game?')) {
        window.close();
    }
}

// 返回主菜单
function backToMenu() {
    document.getElementById('leaderboard').style.display = 'none';
    document.getElementById('settings').style.display = 'none';
    document.getElementById('main-menu').style.display = 'flex';
}

// 保存设置
function saveSettings() {
    gameSettings.boardSize = parseInt(document.getElementById('board-size').value);
    gameSettings.language = document.getElementById('language').value;
    
    // 保存到本地存储
    localStorage.setItem('gomokuSettings', JSON.stringify(gameSettings));
    
    // 更新界面上的文本
    updateUIText();
    
    alert(gameSettings.language === 'zh-CN' ? '设置已保存！' : 'Settings saved!');
    backToMenu();
}

// 加载设置
function loadSettings() {
    try {
        const savedSettings = localStorage.getItem('gomokuSettings');
        if (savedSettings) {
            gameSettings = JSON.parse(savedSettings);
        }
    } catch (e) {
        console.error('Failed to load settings:', e);
    }
}

// 更新界面文本（根据语言设置）
function updateUIText() {
    // 更新游戏信息区域
    const currentPlayerText = document.querySelector('.current-player');
    if (currentPlayerText) {
        currentPlayerText.firstChild.textContent = gameSettings.language === 'zh-CN' ? '当前玩家: ' : 'Current Player: ';
    }
    
    // 更新按钮文本
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
        resetBtn.textContent = gameSettings.language === 'zh-CN' ? '重新开始' : 'Restart';
    }
    
    const backBtn = document.getElementById('back-to-menu');
    if (backBtn) {
        backBtn.textContent = gameSettings.language === 'zh-CN' ? '返回主菜单' : 'Main Menu';
    }
    
    const undoBtn = document.getElementById('undo-btn');
    if (undoBtn) {
        // 保留次数信息，只修改按钮文本
        const currentText = undoBtn.textContent;
        const hasCount = currentText.includes('(') && currentText.includes(')');
        if (hasCount) {
            // 如果已有次数信息，只替换前缀
            const countPart = currentText.match(/\(.*\)/)[0];
            undoBtn.textContent = `${gameSettings.language === 'zh-CN' ? '悔棋' : 'Undo'}${countPart}`;
        } else {
            // 如果没有次数信息，添加默认次数
            undoBtn.textContent = `${gameSettings.language === 'zh-CN' ? '悔棋' : 'Undo'}(0/3)`;
        }
    }
    
    const playAgainBtn = document.getElementById('play-again');
    if (playAgainBtn) {
        playAgainBtn.textContent = gameSettings.language === 'zh-CN' ? '再玩一次' : 'Play Again';
    }
}

// 更新排行榜
function updateLeaderboard(winner, gameTime) {
    // 简化处理：假设玩家名称为"玩家1"
    const playerName = gameSettings.language === 'zh-CN' ? "玩家1" : "Player 1";
    
    // 查找是否已有该玩家记录
    let playerRecord = leaderboardData.find(record => record.player === playerName);
    
    if (playerRecord) {
        playerRecord.wins += 1;
        if (gameTime < playerRecord.fastestTime || playerRecord.fastestTime === 0) {
            playerRecord.fastestTime = gameTime;
        }
    } else {
        playerRecord = {
            player: playerName,
            wins: 1,
            fastestTime: gameTime
        };
        leaderboardData.push(playerRecord);
    }
    
    // 保存到本地存储
    localStorage.setItem('gomokuLeaderboard', JSON.stringify(leaderboardData));
}

// 渲染排行榜
function renderLeaderboard() {
    // 按胜利次数排序，胜利次数相同时按最短时间排序
    leaderboardData.sort((a, b) => {
        if (b.wins !== a.wins) {
            return b.wins - a.wins; // 胜利次数多的排前面
        }
        return a.fastestTime - b.fastestTime; // 时间短的排前面
    });
    
    const tbody = document.getElementById('leaderboard-body');
    tbody.innerHTML = '';
    
    // 更新表头
    const tableHeaders = document.querySelectorAll('#leaderboard-table th');
    if (tableHeaders.length >= 4) {
        tableHeaders[0].textContent = gameSettings.language === 'zh-CN' ? '排名' : 'Rank';
        tableHeaders[1].textContent = gameSettings.language === 'zh-CN' ? '玩家' : 'Player';
        tableHeaders[2].textContent = gameSettings.language === 'zh-CN' ? '胜利局数' : 'Wins';
        tableHeaders[3].textContent = gameSettings.language === 'zh-CN' ? '最短用时' : 'Fastest Time';
    }
    
    leaderboardData.forEach((record, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${record.player}</td>
            <td>${record.wins}</td>
            <td>${record.fastestTime > 0 ? record.fastestTime + (gameSettings.language === 'zh-CN' ? '秒' : 's') : 'N/A'}</td>
        `;
        tbody.appendChild(row);
    });
    
    // 如果没有数据，显示提示信息
    if (leaderboardData.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="4">${gameSettings.language === 'zh-CN' ? '暂无数据' : 'No data available'}</td>`;
        tbody.appendChild(row);
    }
}