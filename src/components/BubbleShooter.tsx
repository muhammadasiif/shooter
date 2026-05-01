/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Target, RotateCcw, Trophy, Play, Star, Sparkles } from 'lucide-react';

// --- Constants ---
const BUBBLE_RADIUS = 20;
const GRID_ROWS = 12;
const GRID_COLS = 14;
const WIN_SCORE = 1000;
const COLORS = [
  '#FF5F5F', // Red
  '#5FBFFF', // Blue
  '#5FFF9F', // Green
  '#FFDF5F', // Yellow
  '#DF5FFF', // Purple
  '#FF9F5F', // Orange
];

type Bubble = {
  x: number;
  y: number;
  color: string;
  id: string;
};

type Shot = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
};

// --- Helper Functions ---
const getDistance = (x1: number, y1: number, x2: number, y2: number) => {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
};

export default function BubbleShooter() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<'start' | 'playing' | 'gameover' | 'victory'>('start');
  const [score, setScore] = useState(0);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [shot, setShot] = useState<Shot | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [nextColor, setNextColor] = useState(COLORS[Math.floor(Math.random() * COLORS.length)]);
  const [cannonX, setCannonX] = useState(280); // Default center
  const [mousePos, setMousePos] = useState({ x: 280, y: 0 });

  // Initialize bubbles
  const initGame = useCallback(() => {
    const newBubbles: Bubble[] = [];
    const rowsToFill = 6;
    for (let r = 0; r < rowsToFill; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const isOddRow = r % 2 !== 0;
        const x = c * (BUBBLE_RADIUS * 2) + BUBBLE_RADIUS + (isOddRow ? BUBBLE_RADIUS : 0);
        const y = r * (BUBBLE_RADIUS * Math.sqrt(3)) + BUBBLE_RADIUS;
        
        newBubbles.push({
          x,
          y,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          id: `bubble-${r}-${c}-${Math.random()}`,
        });
      }
    }
    setBubbles(newBubbles);
    setScore(0);
    setParticles([]);
    setGameState('playing');
    setShot(null);
    setCannonX(280);
    setNextColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
  }, []);

  const handleShoot = useCallback(() => {
    if (gameState !== 'playing' || shot) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const startX = cannonX;
    const startY = canvas.height - 60;
    const dx = mousePos.x - startX;
    const dy = mousePos.y - startY;
    const angle = Math.atan2(dy, dx);
    const speed = 18;
    
    setShot({
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: nextColor,
    });
    setNextColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
  }, [gameState, shot, cannonX, mousePos, nextColor]);

  // Find cluster of same color
  const findCluster = (root: Bubble, all: Bubble[]): string[] => {
    const cluster: string[] = [];
    const queue: Bubble[] = [root];
    const visited = new Set<string>();
    visited.add(root.id);

    while (queue.length > 0) {
      const current = queue.shift()!;
      cluster.push(current.id);

      const neighbors = all.filter(b => 
        !visited.has(b.id) && 
        b.color === root.color && 
        getDistance(current.x, current.y, b.x, b.y) < BUBBLE_RADIUS * 2.2
      );

      neighbors.forEach(n => {
        visited.add(n.id);
        queue.push(n);
      });
    }
    return cluster;
  };

  const resolveCollision = useCallback((s: Shot, hitBubble: Bubble | null) => {
    let currentBubbles = [...bubbles];
    
    // Snap and add if needed, or check if hit color
    // Standard logic: find best spot 
    const snappedBubble: Bubble = {
        x: s.x,
        y: s.y,
        color: s.color,
        id: `b-${Date.now()}`
    };

    // If it hit a bubble, we check that cluster
    // If it hit the top, we snap it there
    let clusterToRemove: string[] = [];
    if (hitBubble && hitBubble.color === s.color) {
        clusterToRemove = findCluster(hitBubble, currentBubbles);
    }

    if (clusterToRemove.length > 0) {
        // Popping logic
        const newParticles: Particle[] = [];
        const bubblesPopped = currentBubbles.filter(b => clusterToRemove.includes(b.id));
        
        bubblesPopped.forEach(b => {
          for (let i = 0; i < 12; i++) {
            newParticles.push({
              x: b.x,
              y: b.y,
              vx: (Math.random() - 0.5) * 6,
              vy: (Math.random() - 0.5) * 6,
              life: 1.0,
              color: b.color,
              size: Math.random() * 5 + 2
            });
          }
        });
        setParticles(prev => [...prev, ...newParticles]);

        const remaining = currentBubbles.filter(b => !clusterToRemove.includes(b.id));
        
        // Find floaters
        const connectedToTop = new Set<string>();
        const topOnes = remaining.filter(b => b.y < BUBBLE_RADIUS * 2.5);
        const queue = [...topOnes];
        topOnes.forEach(b => connectedToTop.add(b.id));

        let head = 0;
        while (head < queue.length) {
            const curr = queue[head++];
            const neighbors = remaining.filter(b => 
                !connectedToTop.has(b.id) && 
                getDistance(curr.x, curr.y, b.x, b.y) < BUBBLE_RADIUS * 2.2
            );
            neighbors.forEach(n => {
                connectedToTop.add(n.id);
                queue.push(n);
            });
        }

        const finalBubbles = remaining.filter(b => connectedToTop.has(b.id));
        const droppedCount = remaining.length - finalBubbles.length;
        
        setBubbles(finalBubbles);
        setScore(prev => {
            const newScore = prev + (clusterToRemove.length + droppedCount) * 10;
            if (newScore >= WIN_SCORE) setGameState('victory');
            return Math.min(newScore, 9999); // Safety cap
        });
    } else {
        // Just add it to the board
        setBubbles(prev => [...prev, snappedBubble]);
    }

    setShot(null);
  }, [bubbles]);

  useEffect(() => {
    if (gameState !== 'playing') return;
    let frameId: number;

    const update = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw Background with Gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bgGrad.addColorStop(0, '#0a0a0c');
      bgGrad.addColorStop(1, '#1a1a20');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid Pattern
      ctx.strokeStyle = '#ffffff05';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Particles
      setParticles(prev => prev.map(p => ({
        ...p,
        x: p.x + p.vx,
        y: p.y + p.vy,
        life: p.life - 0.015,
        vx: p.vx * 0.98,
        vy: p.vy * 0.98 + 0.1 // Gravity
      })).filter(p => p.life > 0));

      particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        // Add glow to particles
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
        ctx.fill();
        ctx.shadowBlur = 0;
      });
      ctx.globalAlpha = 1;

      // Shot update
      if (shot) {
        shot.x += shot.vx;
        shot.y += shot.vy;
        
        if (shot.x < BUBBLE_RADIUS || shot.x > canvas.width - BUBBLE_RADIUS) shot.vx *= -1;
        
        let hit = false;
        let targetBubble: Bubble | null = null;
        if (shot.y < BUBBLE_RADIUS) hit = true;
        
        for (const b of bubbles) {
          if (getDistance(shot.x, shot.y, b.x, b.y) < BUBBLE_RADIUS * 1.7) {
            hit = true;
            targetBubble = b;
            break;
          }
        }

        if (hit) {
          resolveCollision(shot, targetBubble);
        } else {
          ctx.shadowBlur = 20;
          ctx.shadowColor = shot.color;
          ctx.beginPath();
          ctx.arc(shot.x, shot.y, BUBBLE_RADIUS, 0, Math.PI * 2);
          ctx.fillStyle = shot.color;
          ctx.fill();
          // Inner shine
          ctx.fillStyle = '#ffffff44';
          ctx.beginPath();
          ctx.arc(shot.x - 5, shot.y - 5, BUBBLE_RADIUS / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      // Bubbles
      bubbles.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, BUBBLE_RADIUS - 1, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(b.x - 6, b.y - 6, 2, b.x, b.y, BUBBLE_RADIUS);
        grad.addColorStop(0, '#ffffff88');
        grad.addColorStop(0.3, b.color);
        grad.addColorStop(1, '#00000044');
        ctx.fillStyle = grad;
        ctx.fill();
        
        // Edge rim
        ctx.strokeStyle = '#ffffff22';
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // --- Enhanced Shooting Area ---
      const startX = cannonX;
      const startY = canvas.height - 60;
      const angle = Math.atan2(mousePos.y - startY, mousePos.x - startX);
      
      // Cannon mechanics
      ctx.save();
      ctx.translate(startX, startY);
      ctx.rotate(angle);
      
      // Aiming Guide (dashed line)
      ctx.setLineDash([5, 10]);
      ctx.strokeStyle = '#ffffff22';
      ctx.beginPath();
      ctx.moveTo(60, 0);
      ctx.lineTo(600, 0);
      ctx.stroke();
      ctx.setLineDash([]);

      // Barrel Design
      const barrelGrad = ctx.createLinearGradient(0, -15, 0, 15);
      barrelGrad.addColorStop(0, '#444');
      barrelGrad.addColorStop(0.5, '#666');
      barrelGrad.addColorStop(1, '#333');
      ctx.fillStyle = barrelGrad;
      
      ctx.beginPath();
      ctx.roundRect(0, -15, 65, 30, [0, 8, 8, 0]);
      ctx.fill();
      
      // Detail on barrel
      ctx.fillStyle = '#222';
      ctx.fillRect(45, -17, 10, 34);
      ctx.fillStyle = '#ff0000aa';
      ctx.fillRect(10, -5, 30, 2);
      
      ctx.restore();

      // Base Platform
      const baseGrad = ctx.createRadialGradient(startX, startY, 0, startX, startY, 70);
      baseGrad.addColorStop(0, '#333');
      baseGrad.addColorStop(1, '#111');
      ctx.beginPath();
      ctx.arc(startX, startY + 20, 70, Math.PI, 0);
      ctx.fillStyle = baseGrad;
      ctx.fill();
      ctx.strokeStyle = '#444';
      ctx.stroke();
      
      // Next Loaded Bubble in Chamber
      ctx.shadowBlur = 15;
      ctx.shadowColor = nextColor;
      ctx.beginPath();
      ctx.arc(startX, startY, BUBBLE_RADIUS + 2, 0, Math.PI * 2);
      const chamberGrad = ctx.createRadialGradient(startX - 5, startY - 5, 2, startX, startY, BUBBLE_RADIUS);
      chamberGrad.addColorStop(0, '#ffffffaa');
      chamberGrad.addColorStop(1, nextColor);
      ctx.fillStyle = chamberGrad;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Check Game Over
      if (bubbles.some(b => b.y > canvas.height - 150)) {
        setGameState('gameover');
      }

      frameId = requestAnimationFrame(update);
    };
    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
  }, [gameState, bubbles, shot, particles, nextColor, mousePos, cannonX, resolveCollision]);

  const handleInput = useCallback((clientX: number, clientY: number, isMove: boolean) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    // Scale coordinates if the canvas is visually scaled
    const scaleX = 560 / rect.width;
    const scaleY = 780 / rect.height;
    
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    
    setMousePos({ x, y });
    
    // Move cannon base if it's a movement event
    if (isMove) {
      const clampedX = Math.max(BUBBLE_RADIUS * 2, Math.min(x, 560 - BUBBLE_RADIUS * 2));
      setCannonX(clampedX);
    }
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#08080a] text-white font-sans selection:bg-red-500/30 overflow-hidden touch-none">
      {/* Header UI */}
      <div className="w-full max-w-2xl px-8 py-6 flex items-center justify-between z-10">
        <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
          <h1 className="text-4xl font-black tracking-tighter uppercase italic flex items-center gap-3 text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
            <div className="p-2 bg-red-600 rounded-lg skew-x-[-10deg]">
               <Target strokeWidth={3} className="text-white" />
            </div>
            Bubble Shooter
          </h1>
          <p className="text-[11px] text-neutral-500 font-mono tracking-[0.3em] uppercase mt-1 pl-1">Created by Muhammad Asif</p>
        </motion.div>

        <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="text-right">
          <div className="text-[10px] font-mono text-neutral-500 tracking-widest mb-1 italic">STRIKE SCORE</div>
          <div className="text-5xl font-black font-mono flex items-center gap-3 tabular-nums text-yellow-400">
             <Trophy size={24} className="text-yellow-500 animate-pulse" />
             {score.toString().padStart(3, '0')}
          </div>
          <div className="w-full h-1 bg-neutral-800 rounded-full mt-2 overflow-hidden">
             <motion.div 
               className="h-full bg-yellow-500"
               initial={{ width: 0 }}
               animate={{ width: `${(score / WIN_SCORE) * 100}%` }}
             />
          </div>
        </motion.div>
      </div>

      {/* Main Game Frame */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        ref={containerRef} 
        className="relative w-full max-w-2xl aspect-[3/4.2] bg-black rounded-[2.5rem] border-[12px] border-neutral-800 shadow-[0_0_150px_rgba(0,0,0,0.8)] overflow-hidden cursor-crosshair group"
        onMouseMove={(e) => handleInput(e.clientX, e.clientY, true)}
        onClick={handleShoot}
        onTouchMove={(e) => {
          const touch = e.touches[0];
          handleInput(touch.clientX, touch.clientY, true);
        }}
        onTouchEnd={(e) => {
          // If we want a separate tap-to-fire mechanic or just firing on release
          handleShoot();
        }}
      >
        <canvas ref={canvasRef} width={560} height={780} className="w-full h-full" />

        <AnimatePresence>
          {gameState === 'start' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center gap-10 p-12 text-center backdrop-blur-md">
              <motion.div 
                animate={{ 
                  scale: [1, 1.1, 1],
                  rotate: [0, 5, -5, 0]
                }} 
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="relative"
              >
                <div className="absolute inset-0 bg-red-500 blur-3xl opacity-20" />
                <Target size={120} className="text-red-500 relative z-10" strokeWidth={1.5} />
              </motion.div>
              <div className="space-y-4">
                <h2 className="text-7xl font-black italic tracking-tighter text-white">READY?</h2>
                <p className="text-neutral-400 font-mono text-sm tracking-[0.2em] uppercase max-w-sm mx-auto leading-relaxed">
                  Clear the board before the ceiling crashes down. Win at <span className="text-yellow-500">1000 points</span>.
                </p>
              </div>
              <button 
                onClick={initGame} 
                className="group px-14 py-6 bg-red-600 text-white font-black uppercase tracking-tighter rounded-2xl hover:bg-white hover:text-black transition-all transform hover:scale-105 active:scale-95 flex items-center gap-4 shadow-[0_10px_40px_rgba(220,38,38,0.4)]"
              >
                <Play fill="currentColor" size={24} />
                Deploy Mission
              </button>
            </motion.div>
          )}

          {gameState === 'victory' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-yellow-500/10 flex flex-col items-center justify-center gap-10 p-12 text-center backdrop-blur-xl border-[20px] border-yellow-500/20">
               <motion.div animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="absolute opacity-10">
                  <Star size={600} className="text-yellow-500" />
               </motion.div>
               
               <div className="z-10 space-y-2">
                  <div className="flex justify-center mb-4">
                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity }}>
                        <Trophy size={100} className="text-yellow-400" />
                    </motion.div>
                  </div>
                  <h2 className="text-8xl font-black italic tracking-tighter text-white drop-shadow-2xl">VICTORY</h2>
                  <p className="text-yellow-200 font-mono text-lg tracking-[0.4em] uppercase">Target Goal Reached</p>
               </div>
               
               <div className="z-10 bg-black/60 p-12 rounded-[3rem] border-2 border-yellow-500/30 backdrop-blur-2xl shadow-2xl">
                  <div className="text-xs font-mono text-yellow-500/50 mb-3 tracking-[0.5em]">HALL OF FAME SCORE</div>
                  <div className="text-8xl font-black font-mono text-yellow-400 tabular-nums">{score}</div>
               </div>

               <button onClick={initGame} className="z-10 px-14 py-6 bg-white text-black font-black uppercase tracking-tighter rounded-2xl hover:bg-yellow-400 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-4">
                <RotateCcw strokeWidth={3} />
                Play Again
              </button>
            </motion.div>
          )}

          {gameState === 'gameover' && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="absolute inset-0 bg-red-950/90 flex flex-col items-center justify-center gap-10 p-12 text-center backdrop-blur-md">
              <h2 className="text-7xl font-black italic tracking-tight text-white drop-shadow-2xl">DEFEATED</h2>
              <div className="bg-black/50 p-12 rounded-[3rem] border-2 border-white/10 backdrop-blur-xl shadow-2xl">
                <div className="text-[10px] font-mono text-white/50 mb-2 tracking-[0.5em]">FINAL PERFORMANCE</div>
                <div className="text-8xl font-black font-mono text-white tabular-nums">{score}</div>
              </div>
              <button 
                onClick={initGame} 
                className="px-14 py-6 bg-white text-black font-black uppercase tracking-tighter rounded-2xl hover:bg-neutral-200 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-4"
              >
                <RotateCcw strokeWidth={3} />
                Restart Mission
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Footer Instructions */}
      <div className="mt-10 flex gap-16 text-[11px] font-mono text-neutral-600 uppercase tracking-[0.3em]">
        <div className="flex items-center gap-3 group">
          <div className="w-2 h-2 rounded-full bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.8)]" />
          <span className="group-hover:text-neutral-400 transition-colors">Precision Aim</span>
        </div>
        <div className="flex items-center gap-3 group">
          <div className="w-2 h-2 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.8)]" />
          <span className="group-hover:text-neutral-400 transition-colors">Tactical Fire</span>
        </div>
        <div className="flex items-center gap-3 group">
          <div className="w-2 h-2 rounded-full bg-green-600 shadow-[0_0_8px_rgba(22,163,74,0.8)]" />
          <span className="group-hover:text-neutral-400 transition-colors">Elite Match</span>
        </div>
      </div>
    </div>
  );
}
