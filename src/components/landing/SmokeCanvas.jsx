import { useEffect, useRef } from 'react'

export default function SmokeCanvas() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let W = canvas.width = window.innerWidth
    let H = canvas.height = window.innerHeight
    let raf

    const particles = Array.from({ length: 60 }, () => createParticle(W, H))

    function createParticle(w, h) {
      return {
        x: Math.random() * w,
        y: h + Math.random() * 100,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -(0.2 + Math.random() * 0.5),
        alpha: Math.random() * 0.06 + 0.01,
        r: 40 + Math.random() * 80,
        life: 0,
        maxLife: 120 + Math.random() * 200,
      }
    }

    function draw() {
      ctx.clearRect(0, 0, W, H)
      for (const p of particles) {
        p.life++
        p.x += p.vx
        p.y += p.vy
        p.r += 0.3

        const progress = p.life / p.maxLife
        const a = p.alpha * (1 - progress)

        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r)
        g.addColorStop(0, `rgba(255,255,255,${a})`)
        g.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()

        if (p.life >= p.maxLife) {
          Object.assign(p, createParticle(W, H))
        }
      }
      raf = requestAnimationFrame(draw)
    }

    draw()

    const onResize = () => {
      W = canvas.width = window.innerWidth
      H = canvas.height = window.innerHeight
    }
    window.addEventListener('resize', onResize)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize) }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.6 }}
    />
  )
}
