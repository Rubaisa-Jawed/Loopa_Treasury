import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, HTMLAttributes, PointerEvent, ReactNode } from 'react'
import {
  ArrowRight,
  BellRing,
  Bot,
  Check,
  ChevronRight,
  Coins,
  Fingerprint,
  Gauge,
  LineChart,
  LockKeyhole,
  MessageCircle,
  Radar,
  Repeat2,
  ShieldCheck,
  Sparkles,
  Wallet,
  Zap
} from 'lucide-react'
import FundAgentWallet from './pages/FundAgentWallet.js'

type PromptKey = 'yield' | 'rebalance' | 'protect'
type RiskKey = 'steady' | 'balanced' | 'turbo'

const promptResponses: Record<
  PromptKey,
  {
    prompt: string
    title: string
    copy: string
    stats: Array<{ label: string; value: string }>
  }
> = {
  yield: {
    prompt: 'Find the cleanest yield for 500 USDC',
    title: '3 routes ranked by APY, TVL, and risk',
    copy: 'Loopa compares Kamino lending, Raydium LPs, and Marinade staking, then prepares the safest executable route for approval.',
    stats: [
      { label: 'Best route', value: 'Kamino USDC' },
      { label: 'Net APY', value: '8.4%' },
      { label: 'Risk', value: 'Low' }
    ]
  },
  rebalance: {
    prompt: 'Rebalance to 60% SOL and 40% stables',
    title: 'Treasury drift detected and corrected',
    copy: 'The agent simulates Jupiter routes, estimates slippage, and builds one confirmation bundle before anything touches chain.',
    stats: [
      { label: 'Swaps', value: '2' },
      { label: 'Impact', value: '0.04%' },
      { label: 'Confirm', value: 'Required' }
    ]
  },
  protect: {
    prompt: 'Alert me if SOL breaks below $120',
    title: 'Autonomous monitoring goes live',
    copy: 'Loopa watches price levels, position drawdown, and yield changes, then sends Telegram-native alerts before the treasury sleeps.',
    stats: [
      { label: 'Cadence', value: '4h' },
      { label: 'Signal', value: 'Pyth' },
      { label: 'Channel', value: 'Telegram' }
    ]
  }
}

const riskProfiles: Record<
  RiskKey,
  {
    label: string
    allocation: string
    copy: string
    yield: string
    color: string
  }
> = {
  steady: {
    label: 'Steady',
    allocation: '72% stables / 18% SOL / 10% liquid staking',
    copy: 'Built for capital preservation, low slippage, and conservative yield routes.',
    yield: '5.6%',
    color: '#35c8a3'
  },
  balanced: {
    label: 'Balanced',
    allocation: '44% stables / 36% SOL / 20% DeFi yield',
    copy: 'Keeps the treasury productive without handing the steering wheel to volatility.',
    yield: '8.4%',
    color: '#f6b74f'
  },
  turbo: {
    label: 'Turbo',
    allocation: '28% stables / 42% SOL / 30% LP and staking',
    copy: 'Pushes harder into managed LP exposure with extra alerts and tighter exits.',
    yield: '13.2%',
    color: '#ff6b61'
  }
}

const agentSteps = [
  {
    label: 'Read',
    value: 'Portfolio state',
    detail: 'Balances, LPs, staking, and open alerts flow in from Solana.'
  },
  {
    label: 'Reason',
    value: 'Strategy fit',
    detail: 'The AI compares risk appetite, liquidity, price impact, and yield.'
  },
  {
    label: 'Prepare',
    value: 'Unsigned action',
    detail: 'Every swap, deposit, or stake is simulated before confirmation.'
  },
  {
    label: 'Report',
    value: 'Telegram update',
    detail: 'Results return as compact messages with transaction links.'
  }
]

const integrations = ['Telegram', 'Phantom', 'Jupiter', 'Kamino', 'Raydium', 'Marinade', 'x402', 'Umbra']

function TreasuryScene() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const pointerRef = useRef({ x: 0.5, y: 0.45, active: false })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext('2d')
    if (!context) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let width = 0
    let height = 0
    let frame = 0
    let animation = 0
    const nodeCount = 36
    const nodes = Array.from({ length: nodeCount }, (_, index) => ({
      orbit: 0.15 + (index % 9) * 0.035,
      phase: (index / nodeCount) * Math.PI * 2,
      speed: 0.0018 + (index % 7) * 0.00032,
      size: 1.7 + (index % 5) * 0.55,
      tone: index % 3
    }))

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const ratio = window.devicePixelRatio || 1
      width = rect.width
      height = rect.height
      canvas.width = Math.floor(width * ratio)
      canvas.height = Math.floor(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
    }

    const draw = () => {
      frame += reduceMotion ? 0.28 : 1
      context.clearRect(0, 0, width, height)

      const gradient = context.createLinearGradient(0, 0, width, height)
      gradient.addColorStop(0, '#0f1117')
      gradient.addColorStop(0.42, '#101d1a')
      gradient.addColorStop(1, '#19150f')
      context.fillStyle = gradient
      context.fillRect(0, 0, width, height)

      const pointer = pointerRef.current
      const centerX = width * (0.58 + (pointer.x - 0.5) * 0.08)
      const centerY = height * (0.48 + (pointer.y - 0.5) * 0.08)
      const radius = Math.min(width, height) * 0.82

      const positions = nodes.map((node) => {
        const pulse = Math.sin(frame * node.speed * 7 + node.phase)
        const angle = node.phase + frame * node.speed
        const rx = radius * node.orbit * (1.3 + pulse * 0.08)
        const ry = radius * node.orbit * (0.72 + pulse * 0.05)
        return {
          x: centerX + Math.cos(angle) * rx,
          y: centerY + Math.sin(angle) * ry,
          size: node.size + pulse * 0.45,
          tone: node.tone
        }
      })

      context.lineWidth = 1
      positions.forEach((point, index) => {
        const partner = positions[(index + 9) % positions.length]
        const distance = Math.hypot(point.x - partner.x, point.y - partner.y)
        const alpha = Math.max(0.05, 0.28 - distance / 1800)
        context.strokeStyle = `rgba(83, 241, 194, ${alpha})`
        context.beginPath()
        context.moveTo(point.x, point.y)
        const controlX = (point.x + partner.x) / 2 + Math.sin(frame * 0.006 + index) * 36
        const controlY = (point.y + partner.y) / 2 + Math.cos(frame * 0.005 + index) * 28
        context.quadraticCurveTo(controlX, controlY, partner.x, partner.y)
        context.stroke()
      })

      const pointerGlow = context.createRadialGradient(
        width * pointer.x,
        height * pointer.y,
        0,
        width * pointer.x,
        height * pointer.y,
        Math.min(width, height) * 0.42
      )
      pointerGlow.addColorStop(0, 'rgba(255, 197, 91, 0.22)')
      pointerGlow.addColorStop(0.38, 'rgba(80, 218, 174, 0.12)')
      pointerGlow.addColorStop(1, 'rgba(80, 218, 174, 0)')
      context.fillStyle = pointerGlow
      context.fillRect(0, 0, width, height)

      positions.forEach((point, index) => {
        const palette = point.tone === 0 ? '#5ff0c6' : point.tone === 1 ? '#f9c85d' : '#ff8177'
        context.fillStyle = palette
        context.shadowColor = palette
        context.shadowBlur = pointer.active ? 18 : 12
        context.beginPath()
        context.arc(point.x, point.y, point.size, 0, Math.PI * 2)
        context.fill()

        if (index % 7 === 0) {
          context.strokeStyle = `rgba(255, 255, 255, ${pointer.active ? 0.22 : 0.13})`
          context.shadowBlur = 0
          context.beginPath()
          context.arc(point.x, point.y, point.size + 8 + Math.sin(frame * 0.025 + index) * 3, 0, Math.PI * 2)
          context.stroke()
        }
      })

      context.shadowBlur = 0
      context.fillStyle = 'rgba(255, 255, 255, 0.72)'
      context.font = '600 12px Inter, system-ui, sans-serif'
      context.fillText('USDC', centerX - 32, centerY - 14)
      context.fillText('SOL', centerX + 28, centerY + 20)

      animation = window.requestAnimationFrame(draw)
    }

    resize()
    draw()
    window.addEventListener('resize', resize)

    return () => {
      window.removeEventListener('resize', resize)
      window.cancelAnimationFrame(animation)
    }
  }, [])

  const updatePointer = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    pointerRef.current = {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
      active: true
    }
  }

  return (
    <canvas
      ref={canvasRef}
      className="treasury-scene"
      aria-hidden="true"
      onPointerMove={(event) => updatePointer(event.clientX, event.clientY)}
      onPointerEnter={() => {
        pointerRef.current.active = true
      }}
      onPointerLeave={() => {
        pointerRef.current.active = false
      }}
    />
  )
}

function TiltPanel({
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement | null>(null)

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const element = ref.current
    if (!element) return
    const rect = element.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width - 0.5
    const y = (event.clientY - rect.top) / rect.height - 0.5
    element.style.setProperty('--tilt-x', `${(-y * 5).toFixed(2)}deg`)
    element.style.setProperty('--tilt-y', `${(x * 6).toFixed(2)}deg`)
    element.style.setProperty('--spot-x', `${event.clientX - rect.left}px`)
    element.style.setProperty('--spot-y', `${event.clientY - rect.top}px`)
  }

  const reset = () => {
    const element = ref.current
    if (!element) return
    element.style.setProperty('--tilt-x', '0deg')
    element.style.setProperty('--tilt-y', '0deg')
  }

  return (
    <div ref={ref} className={`tilt-panel ${className}`} onPointerMove={onPointerMove} onPointerLeave={reset} {...props}>
      {children}
    </div>
  )
}

function PromptConsole() {
  const [activePrompt, setActivePrompt] = useState<PromptKey>('yield')
  const response = promptResponses[activePrompt]

  return (
    <TiltPanel className="agent-console" aria-label="Loopa Treasury agent preview">
      <div className="console-topbar">
        <span />
        <span />
        <span />
      </div>
      <div className="console-header">
        <div>
          <p className="eyebrow">Telegram command</p>
          <h2>Ask once. Approve only when ready.</h2>
        </div>
        <div className="console-badge">
          <ShieldCheck size={16} />
          Non-custodial
        </div>
      </div>

      <div className="prompt-picker" role="tablist" aria-label="Sample treasury prompts">
        {(Object.keys(promptResponses) as PromptKey[]).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={activePrompt === key}
            className={activePrompt === key ? 'is-active' : ''}
            onClick={() => setActivePrompt(key)}
          >
            {promptResponses[key].prompt}
          </button>
        ))}
      </div>

      <div className="message-stack">
        <div className="telegram-bubble user-bubble">{response.prompt}</div>
        <div className="telegram-bubble agent-bubble">
          <div className="agent-bubble-title">
            <Bot size={18} />
            {response.title}
          </div>
          <p>{response.copy}</p>
          <div className="stat-strip">
            {response.stats.map((stat) => (
              <span key={stat.label}>
                <strong>{stat.value}</strong>
                {stat.label}
              </span>
            ))}
          </div>
          <div className="approval-row">
            <button type="button">
              <Check size={16} />
              Confirm
            </button>
            <button type="button">Simulate again</button>
          </div>
        </div>
      </div>
    </TiltPanel>
  )
}

function RiskDesigner() {
  const [risk, setRisk] = useState<RiskKey>('balanced')
  const profile = riskProfiles[risk]

  return (
    <section className="strategy-band" id="strategy">
      <div className="section-copy">
        <p className="eyebrow">Strategy engine</p>
        <h2>Designed for treasuries that move in loops, not straight lines.</h2>
        <p>
          Loopa keeps capital cycling through discovery, simulation, confirmation, execution, and monitoring so DeFi actions stay deliberate.
        </p>
      </div>

      <TiltPanel className="strategy-designer">
        <div className="risk-tabs" role="tablist" aria-label="Treasury risk profile">
          {(Object.keys(riskProfiles) as RiskKey[]).map((key) => (
            <button
              key={key}
              type="button"
              className={risk === key ? 'is-active' : ''}
              onClick={() => setRisk(key)}
              style={{ '--accent': riskProfiles[key].color } as CSSProperties}
            >
              {riskProfiles[key].label}
            </button>
          ))}
        </div>
        <div className="allocation-visual" style={{ '--accent': profile.color } as CSSProperties}>
          <div className="allocation-ring">
            <span>{profile.yield}</span>
            <small>Target APY</small>
          </div>
          <div>
            <p className="eyebrow">{profile.label} mode</p>
            <h3>{profile.allocation}</h3>
            <p>{profile.copy}</p>
          </div>
        </div>
        <div className="route-list">
          <div>
            <KaminoIcon />
            <span>Kamino lending screened for liquidity depth</span>
          </div>
          <div>
            <RaydiumIcon />
            <span>Raydium LPs checked for fee yield and drawdown</span>
          </div>
          <div>
            <MarinadeIcon />
            <span>Marinade staking used for SOL-denominated yield</span>
          </div>
        </div>
      </TiltPanel>
    </section>
  )
}

function AgentLoop() {
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveStep((step) => (step + 1) % agentSteps.length)
    }, 2600)

    return () => window.clearInterval(timer)
  }, [])

  return (
    <section className="agent-loop-band">
      <div className="agent-loop">
        <div className="section-copy">
          <p className="eyebrow">Agent loop</p>
          <h2>AI handles the complexity. You keep the confirmation key.</h2>
          <p>
            Natural language requests become readable Solana actions with quotes, impact, fees, and transaction reports visible before execution.
          </p>
        </div>

        <div className="loop-grid">
          {agentSteps.map((step, index) => (
            <button
              key={step.label}
              type="button"
              className={activeStep === index ? 'loop-step is-active' : 'loop-step'}
              onClick={() => setActiveStep(index)}
            >
              <span>{step.label}</span>
              <strong>{step.value}</strong>
              <small>{step.detail}</small>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

function FeatureGrid() {
  const features = [
    {
      icon: MessageCircle,
      title: 'Telegram-native treasury control',
      copy: 'Portfolio checks, swaps, yield discovery, and alerts live where crypto teams already coordinate.'
    },
    {
      icon: Radar,
      title: 'Autonomous monitoring',
      copy: 'Position checks run in the background and surface drawdowns, price levels, and new route opportunities.'
    },
    {
      icon: Repeat2,
      title: 'Best-route execution',
      copy: 'Jupiter quotes, Raydium liquidity, Kamino lending, and Marinade staking are compared before a user confirms.'
    },
    {
      icon: LockKeyhole,
      title: 'Privacy-ready flows',
      copy: 'Umbra-style private transfers can protect outgoing treasury movements when discretion matters.'
    },
    {
      icon: Coins,
      title: 'x402 agent payments',
      copy: 'Loopa can pay small USDC fees for premium data and show exactly what it bought for the recommendation.'
    },
    {
      icon: Fingerprint,
      title: 'Non-custodial by design',
      copy: 'Every transaction is simulated and presented for approval. The agent never gets silent authority over funds.'
    }
  ]

  return (
    <section className="feature-band" id="features">
      <div className="section-heading">
        <p className="eyebrow">Product surface</p>
        <h2>A Solana treasury desk with a chat interface.</h2>
      </div>
      <div className="feature-grid">
        {features.map((feature) => {
          const Icon = feature.icon
          return (
            <TiltPanel className="feature-card" key={feature.title}>
              <Icon size={24} />
              <h3>{feature.title}</h3>
              <p>{feature.copy}</p>
            </TiltPanel>
          )
        })}
      </div>
    </section>
  )
}

function IntegrationRail() {
  return (
    <section className="integration-band" id="stack">
      <div className="integration-copy">
        <p className="eyebrow">Solana stack</p>
        <h2>Built for the agent economy, not just another dashboard.</h2>
      </div>
      <div className="integration-rail" aria-label="Supported ecosystem integrations">
        {[...integrations, ...integrations].map((integration, index) => (
          <span key={`${integration}-${index}`}>{integration}</span>
        ))}
      </div>
    </section>
  )
}

function FinalCta() {
  return (
    <section className="final-cta" id="launch">
      <TreasuryScene />
      <div className="final-cta-content">
        <p className="eyebrow">Launch-ready narrative</p>
        <h2>Loopa Treasury turns Solana DeFi into a product anyone can operate from Telegram.</h2>
        <p>
          A polished front door for the hackathon demo, investor link, and early waitlist while the agent backend keeps shipping.
        </p>
        <div className="cta-row">
          <a href="https://t.me/" target="_blank" rel="noreferrer" className="primary-cta">
            Open Telegram
            <ArrowRight size={18} />
          </a>
          <a href="mailto:hello@loopatreasury.com" className="secondary-cta">
            Join waitlist
          </a>
        </div>
      </div>
    </section>
  )
}

function AppLanding() {
  const [scrolled, setScrolled] = useState(false)
  const heroMetrics = useMemo(
    () => [
      { label: 'Treasury checks', value: '24/7' },
      { label: 'Execution', value: 'User-approved' },
      { label: 'Solana focus', value: '100%' }
    ],
    []
  )

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="site-shell">
      <header className={scrolled ? 'site-nav is-scrolled' : 'site-nav'}>
        <a className="brand-mark" href="#top" aria-label="Loopa Treasury home">
          <span>LT</span>
          <strong>Loopa Treasury</strong>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#features">Features</a>
          <a href="#strategy">Strategy</a>
          <a href="#stack">Stack</a>
        </nav>
        <a className="nav-cta" href="#launch">
          Launch
          <ChevronRight size={16} />
        </a>
      </header>

      <main id="top">
        <section className="hero-section">
          <TreasuryScene />
          <div className="hero-grid">
            <div className="hero-copy">
              <div className="hero-kicker">
                <Sparkles size={16} />
                AI treasury agent for Solana DeFi
              </div>
              <h1>Loopa Treasury</h1>
              <p>
                Manage yield, swaps, staking, alerts, and treasury risk from a Telegram-native AI copilot that explains every move before you approve it.
              </p>
              <div className="cta-row">
                <a href="#launch" className="primary-cta">
                  Join early access
                  <ArrowRight size={18} />
                </a>
                <a href="#features" className="secondary-cta">
                  Explore product
                </a>
              </div>
              <div className="hero-metrics" aria-label="Product metrics">
                {heroMetrics.map((metric) => (
                  <span key={metric.label}>
                    <strong>{metric.value}</strong>
                    {metric.label}
                  </span>
                ))}
              </div>
            </div>
            <PromptConsole />
          </div>
        </section>

        <section className="signal-strip" aria-label="Core workflow signals">
          <span>
            <Wallet size={18} />
            Connect wallet
          </span>
          <span>
            <LineChart size={18} />
            Compare yield
          </span>
          <span>
            <Gauge size={18} />
            Simulate action
          </span>
          <span>
            <BellRing size={18} />
            Monitor treasury
          </span>
          <span>
            <Zap size={18} />
            Execute on approval
          </span>
        </section>

        <FeatureGrid />
        <RiskDesigner />
        <AgentLoop />
        <IntegrationRail />
        <FinalCta />
      </main>
    </div>
  )
}

function KaminoIcon() {
  return <span className="protocol-icon protocol-k">K</span>
}

function RaydiumIcon() {
  return <span className="protocol-icon protocol-r">R</span>
}

function MarinadeIcon() {
  return <span className="protocol-icon protocol-m">M</span>
}

export default function App() {
  const fundParams = new URLSearchParams(window.location.search)
  const fundWallet = fundParams.get('fundWallet')
  const fundAmount = fundParams.get('amount') || '0.01'

  useEffect(() => {
    const webApp = window.Telegram?.WebApp
    webApp?.ready()
    webApp?.expand()
  }, [])

  if (fundWallet) {
    return <FundAgentWallet walletAddress={fundWallet} amount={fundAmount} />
  }

  return <AppLanding />
}
