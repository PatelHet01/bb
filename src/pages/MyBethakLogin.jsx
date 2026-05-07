import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCustomerStore } from '../store/customerStore'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { ArrowRight, ArrowLeft } from 'lucide-react'

const STYLES = {
  page: { background: '#000', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', fontFamily: 'Inter, sans-serif' },
  card: { width: '100%', maxWidth: '400px', border: '1px solid rgba(255,255,255,0.1)', padding: '2.5rem', position: 'relative' },
  label: { display: 'block', fontSize: '0.6rem', letterSpacing: '0.3em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: '0.4rem' },
  input: { width: '100%', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'white', padding: '0.85rem 1rem', fontSize: '1rem', outline: 'none', transition: 'border-color 0.2s', colorScheme: 'dark', boxSizing: 'border-box' },
  btn: { width: '100%', background: 'white', color: 'black', border: 'none', padding: '1rem', fontWeight: 900, fontSize: '0.8rem', letterSpacing: '0.25em', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' },
  btnGhost: { background: 'transparent', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.15)', padding: '0.75rem 1rem', fontSize: '0.75rem', cursor: 'pointer', width: '100%', letterSpacing: '0.1em' },
}

export default function MyBethakLogin() {
  const [step, setStep] = useState('mobile') // mobile → otp → done
  const [mobile, setMobile] = useState('')
  const [otp, setOtp] = useState('')
  const [generatedOtp, setGeneratedOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState('login') // login | signup
  const [signupForm, setSignupForm] = useState({ name: '', username: '', dob: '' })
  const { setCustomer } = useCustomerStore()
  const navigate = useNavigate()

  async function handleMobileSubmit(e) {
    e.preventDefault()
    if (mobile.length !== 10) { toast.error('Enter a valid 10-digit number'); return }
    setLoading(true)
    try {
      // Check if customer exists
      const { data: existing } = await supabase.from('customers').select('*').eq('mobile_number', mobile).single()
      if (existing) {
        setMode('login')
      } else {
        setMode('signup')
      }
      // Generate mock OTP (in prod this would be SMS)
      const code = String(Math.floor(100000 + Math.random() * 900000))
      setGeneratedOtp(code)
      toast.success(`OTP: ${code}`, { duration: 30000, icon: '🔑' }) // Show OTP for demo
      setStep('otp')
    } catch (e) {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function handleOtpSubmit(e) {
    e.preventDefault()
    if (otp !== generatedOtp) { toast.error('Invalid OTP'); return }
    setLoading(true)
    try {
      if (mode === 'login') {
        const { data: cust } = await supabase.from('customers').select('*').eq('mobile_number', mobile).single()
        setCustomer(cust)
        toast.success(`Welcome back, ${cust.name}!`)
        navigate('/my-bethak/dashboard')
      } else {
        // Signup
        if (!signupForm.name || !signupForm.username || !signupForm.dob) { toast.error('Fill all fields'); return }
        const { data: newCust, error } = await supabase.from('customers').insert({
          name: signupForm.name,
          username: signupForm.username.toLowerCase(),
          mobile_number: mobile,
          dob: signupForm.dob,
          ghoda_coins: 0,
          branch_id: null,
          registration_type: 'self'
        }).select().single()
        if (error) throw error
        setCustomer(newCust)
        toast.success('Welcome to Bombay Bethak!')
        navigate('/my-bethak/dashboard')
      }
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={STYLES.page}>
      {/* Brand */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <p style={{ fontFamily: 'Georgia, serif', fontSize: '1.8rem', fontWeight: 900, color: 'white', lineHeight: 1 }}>BOMBAY<br />BETHAK</p>
        <p style={{ fontSize: '0.6rem', letterSpacing: '0.4em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginTop: '0.5rem' }}>My Bethak</p>
      </div>

      <AnimatePresence mode="wait">
        {step === 'mobile' && (
          <motion.div key="mobile" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} style={STYLES.card}>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: '1.4rem', color: 'white', marginBottom: '0.5rem', fontWeight: 700 }}>Enter Your Bethak</p>
            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.35)', marginBottom: '2rem' }}>Your mobile number is your identity.</p>
            <form onSubmit={handleMobileSubmit}>
              <label style={STYLES.label}>Mobile Number</label>
              <input
                style={{ ...STYLES.input, fontSize: '1.4rem', letterSpacing: '0.1em', fontWeight: 700 }}
                type="tel" maxLength={10} value={mobile} required
                onChange={e => setMobile(e.target.value.replace(/\D/g, ''))}
                placeholder="9876543210"
                onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.6)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
                autoFocus
              />
              <button type="submit" style={{ ...STYLES.btn, marginTop: '1.5rem' }} disabled={loading}>
                {loading ? 'Checking...' : <><span>Continue</span><ArrowRight size={16} /></>}
              </button>
            </form>
          </motion.div>
        )}

        {step === 'otp' && (
          <motion.div key="otp" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} style={STYLES.card}>
            <button onClick={() => setStep('mobile')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1.5rem', fontSize: '0.8rem', padding: 0 }}>
              <ArrowLeft size={14} /> Back
            </button>

            {mode === 'signup' && (
              <div style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
                <p style={{ fontSize: '0.65rem', letterSpacing: '0.3em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', marginBottom: '1rem' }}>Create Your Profile</p>
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  {[
                    { key: 'name', label: 'Full Name', type: 'text', ph: 'Your name' },
                    { key: 'username', label: 'Bethak Username', type: 'text', ph: 'unique_handle' },
                    { key: 'dob', label: 'Date of Birth', type: 'date', ph: '' },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={STYLES.label}>{f.label}</label>
                      <input
                        style={{ ...STYLES.input, fontSize: '0.9rem' }}
                        type={f.type} placeholder={f.ph} value={signupForm[f.key]}
                        onChange={e => setSignupForm(p => ({ ...p, [f.key]: e.target.value }))}
                        onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.6)'}
                        onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p style={{ fontFamily: 'Georgia, serif', fontSize: '1.2rem', color: 'white', marginBottom: '0.5rem', fontWeight: 700 }}>
              {mode === 'login' ? 'Welcome back.' : 'One last step.'}
            </p>
            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.35)', marginBottom: '1.5rem' }}>
              OTP sent to +91 {mobile}
            </p>

            <form onSubmit={handleOtpSubmit}>
              <label style={STYLES.label}>6-Digit OTP</label>
              <input
                style={{ ...STYLES.input, fontSize: '2rem', letterSpacing: '0.4em', textAlign: 'center', fontWeight: 900 }}
                type="text" maxLength={6} value={otp} required
                onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.6)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
                autoFocus
              />
              <button type="submit" style={{ ...STYLES.btn, marginTop: '1.5rem' }} disabled={loading}>
                {loading ? 'Verifying...' : mode === 'login' ? 'Enter My Bethak' : 'Join Bombay Bethak'}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <p style={{ marginTop: '2rem', fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.1em', textAlign: 'center' }}>
        ⚠️ Tobacco causes cancer. Smoking is injurious to health.
      </p>
    </div>
  )
}
