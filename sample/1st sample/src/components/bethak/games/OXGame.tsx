import { useState } from "react";
import { Button } from "@/components/ui/button";

type Cell = "X" | "O" | null;

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

const winner = (b: Cell[]): Cell => {
  for (const [a, c, d] of LINES) if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
  return null;
};

export const OXGame = () => {
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null));
  const [turn, setTurn] = useState<"X" | "O">("X");

  const w = winner(board);
  const draw = !w && board.every(Boolean);

  const play = (i: number) => {
    if (board[i] || w) return;
    const next = [...board];
    next[i] = turn;
    setBoard(next);
    setTurn(turn === "X" ? "O" : "X");
  };

  const reset = () => {
    setBoard(Array(9).fill(null));
    setTurn("X");
  };

  return (
    <div className="flex flex-col items-center gap-8 w-full">
      <div className="text-xs tracking-[0.3em] uppercase text-white/60">
        {w ? (
          <span className="text-ember">{w} wins</span>
        ) : draw ? (
          "Draw"
        ) : (
          <>Turn: <span className="text-ember">{turn}</span></>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-3xl bg-white/10 p-2 shadow-[0_20px_60px_-20px_rgba(255,255,255,0.15)]">
        {board.map((c, i) => (
          <button
            key={i}
            onClick={() => play(i)}
            className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-gradient-to-br from-zinc-900 to-black flex items-center justify-center font-display text-5xl hover:from-white/10 hover:to-white/[0.02] transition-all duration-200 hover:scale-[1.04]"
            style={{ color: c === "X" ? "#fff" : "hsl(var(--ember))" }}
          >
            {c}
          </button>
        ))}
      </div>

      <Button
        onClick={reset}
        className="rounded-full bg-gradient-to-r from-white to-white/90 text-black hover:from-ember hover:to-ember px-10 py-5 tracking-[0.3em] text-xs uppercase shadow-[0_10px_40px_-10px_rgba(255,255,255,0.4)] hover:shadow-[0_10px_40px_-10px_hsl(var(--ember)/0.6)] transition-all"
      >
        New Round
      </Button>
    </div>
  );
};
