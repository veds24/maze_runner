/*
 * ============================================================
 *  MAZE RUNNER GAME - Written in Pure C
 *  Compiled to WebAssembly using Emscripten
 * ============================================================
 *  Author  : Senior Game Developer
 *  Purpose : Exam-ready structured C program with WebAssembly
 * ============================================================
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#include <emscripten/html5.h>
#endif

/* ─── Constants ─────────────────────────────────────────── */
#define MAX_ROWS   21
#define MAX_COLS   21
#define WALL       '#'
#define PATH       ' '
#define PLAYER     'P'
#define EXIT_CELL  'E'

/* ─── Difficulty Settings ───────────────────────────────── */
typedef struct {
    int   rows;
    int   cols;
    char  name[16];
} Difficulty;

static const Difficulty LEVELS[3] = {
    { 9,  9,  "Easy"   },
    { 15, 15, "Medium" },
    { 21, 21, "Hard"   }
};

/* ─── Game State ────────────────────────────────────────── */
typedef struct {
    char  maze[MAX_ROWS][MAX_COLS];
    int   playerRow;
    int   playerCol;
    int   exitRow;
    int   exitCol;
    int   rows;
    int   cols;
    int   moves;
    int   difficulty;   /* 0 = Easy, 1 = Medium, 2 = Hard */
    int   gameActive;
    int   gameWon;
    double startTime;
} GameState;

static GameState g;   /* global singleton */

/* ─── Utility ───────────────────────────────────────────── */
static double getTime(void) {
#ifdef __EMSCRIPTEN__
    return emscripten_get_now() / 1000.0;   /* ms → s */
#else
    return (double)clock() / CLOCKS_PER_SEC;
#endif
}

/* ─── Maze Generation (Recursive Back-tracker / DFS) ────── */

static void carvePath(int r, int c) {
    /* Directions: up, down, left, right (step by 2 cells) */
    int dr[4] = { -2,  2,  0,  0 };
    int dc[4] = {  0,  0, -2,  2 };

    /* Shuffle directions (Fisher-Yates) */
    int order[4] = { 0, 1, 2, 3 };
    for (int i = 3; i > 0; i--) {
        int j = rand() % (i + 1);
        int tmp = order[i]; order[i] = order[j]; order[j] = tmp;
    }

    for (int i = 0; i < 4; i++) {
        int nr = r + dr[order[i]];
        int nc = c + dc[order[i]];
        /* Wall between current and neighbour */
        int wr = r + dr[order[i]] / 2;
        int wc = c + dc[order[i]] / 2;

        if (nr > 0 && nr < g.rows - 1 &&
            nc > 0 && nc < g.cols - 1 &&
            g.maze[nr][nc] == WALL)
        {
            g.maze[wr][wc] = PATH;
            g.maze[nr][nc] = PATH;
            carvePath(nr, nc);
        }
    }
}

/*
 * generateMaze()
 * Creates a perfect maze using recursive DFS backtracking.
 * Grid must have odd dimensions so walls/paths alternate.
 */
void generateMaze(int difficulty) {
    g.difficulty = difficulty;
    g.rows       = LEVELS[difficulty].rows;
    g.cols       = LEVELS[difficulty].cols;
    g.moves      = 0;
    g.gameWon    = 0;
    g.gameActive = 1;
    g.startTime  = getTime();

    srand((unsigned)time(NULL));

    /* Fill everything with walls */
    for (int r = 0; r < g.rows; r++)
        for (int c = 0; c < g.cols; c++)
            g.maze[r][c] = WALL;

    /* Start carving from (1,1) */
    g.maze[1][1] = PATH;
    carvePath(1, 1);

    /* Place player at top-left passage */
    g.playerRow = 1;
    g.playerCol = 1;
    g.maze[g.playerRow][g.playerCol] = PLAYER;

    /* Place exit at bottom-right passage */
    g.exitRow = g.rows - 2;
    g.exitCol = g.cols - 2;
    g.maze[g.exitRow][g.exitCol] = EXIT_CELL;
}

/*
 * printMaze()
 * Serialises the maze into a flat string for JavaScript.
 * Format: rows,cols,<R*C chars>
 * Each char: '#' wall | ' ' path | 'P' player | 'E' exit
 */
void printMaze(char *out, int bufSize) {
    int offset = snprintf(out, bufSize, "%d,%d,", g.rows, g.cols);
    for (int r = 0; r < g.rows && offset < bufSize - 1; r++)
        for (int c = 0; c < g.cols && offset < bufSize - 1; c++)
            out[offset++] = g.maze[r][c];
    out[offset] = '\0';
}

/*
 * movePlayer()
 * Moves player in direction: 0=up 1=down 2=left 3=right
 * Returns 1 on success, 0 if blocked.
 */
int movePlayer(int direction) {
    if (!g.gameActive || g.gameWon) return 0;

    int dr[4] = { -1,  1,  0,  0 };
    int dc[4] = {  0,  0, -1,  1 };

    int nr = g.playerRow + dr[direction];
    int nc = g.playerCol + dc[direction];

    /* Bounds check */
    if (nr < 0 || nr >= g.rows || nc < 0 || nc >= g.cols) return 0;
    /* Wall check */
    if (g.maze[nr][nc] == WALL) return 0;

    /* Move player */
    g.maze[g.playerRow][g.playerCol] = PATH;
    g.playerRow = nr;
    g.playerCol = nc;
    g.moves++;

    if (checkWin()) {
        g.maze[g.playerRow][g.playerCol] = PLAYER;
        g.gameWon    = 1;
        g.gameActive = 0;
    } else {
        g.maze[g.playerRow][g.playerCol] = PLAYER;
    }
    return 1;
}

/*
 * checkWin()
 * Returns 1 if player reached the exit cell.
 */
int checkWin(void) {
    return (g.playerRow == g.exitRow && g.playerCol == g.exitCol);
}

/* ─── Exported WebAssembly Interface ────────────────────── */

#ifdef __EMSCRIPTEN__

EMSCRIPTEN_KEEPALIVE
void js_startGame(int difficulty) {
    generateMaze(difficulty);
}

EMSCRIPTEN_KEEPALIVE
int js_movePlayer(int direction) {
    return movePlayer(direction);
}

EMSCRIPTEN_KEEPALIVE
int js_checkWin(void) {
    return checkWin();
}

EMSCRIPTEN_KEEPALIVE
int js_getMoves(void) {
    return g.moves;
}

EMSCRIPTEN_KEEPALIVE
double js_getElapsed(void) {
    if (g.gameWon) return g.startTime;   /* frozen at win */
    return getTime() - g.startTime;
}

EMSCRIPTEN_KEEPALIVE
int js_getRows(void) { return g.rows; }

EMSCRIPTEN_KEEPALIVE
int js_getCols(void) { return g.cols; }

/*
 * js_getMazeCell(r, c)
 * Returns the char code of cell (r,c).
 * JS reads: 35='#' 32=' ' 80='P' 69='E'
 */
EMSCRIPTEN_KEEPALIVE
int js_getMazeCell(int r, int c) {
    if (r < 0 || r >= g.rows || c < 0 || c >= g.cols) return '#';
    return (int)g.maze[r][c];
}

EMSCRIPTEN_KEEPALIVE
int js_isGameWon(void) { return g.gameWon; }

#endif /* __EMSCRIPTEN__ */

/* ─── Standalone CLI entry (for native testing) ─────────── */
#ifndef __EMSCRIPTEN__
int main(void) {
    printf("Maze Runner - CLI Test\n");
    generateMaze(0);

    char buf[MAX_ROWS * MAX_COLS + 32];
    printMaze(buf, sizeof(buf));
    printf("Maze data: %s\n", buf);

    printf("Player at (%d,%d), Exit at (%d,%d)\n",
           g.playerRow, g.playerCol, g.exitRow, g.exitCol);
    return 0;
}
#endif
