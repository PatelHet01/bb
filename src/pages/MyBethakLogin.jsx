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
  const [step, setStep] = useState('mobile') // mobile | signup_form | enter_password | create_password | reset_temp_password
  const [mobile, setMobile] = useState('')
  const [loading, setLoading] = useState(false)
  const [signupForm, setSignupForm] = useState({ name: '', username: '', dob: '', password: '' })
  const [tempCustomer, setTempCustomer] = useState(null)
  
  // Password inputs for verification/creation steps
  const [passwordInput, setPasswordInput] = useState('')
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('')
  
  const { setCustomer } = useCustomerStore()
  const navigate = useNavigate()

  async function handleMobileSubmit(e) {
    e.preventDefault()
    if (mobile.length !== 10) { toast.error('Enter a valid 10-digit number'); return }
    setLoading(true)
    try {
      const { data: existing } = await supabase.from('customers').select('*').eq('mobile_number', mobile).single()
      if (existing) {
        setTempCustomer(existing)
        setPasswordInput('')
        setConfirmPasswordInput('')
        if (!existing.password_hash) {
          // Legacy user without a password
          setStep('create_password')
        } else {
          // User with a password
          setStep('enter_password')
        }
      } else {
        setSignupForm({ name: '', username: '', dob: '', password: '' })
        setStep('signup_form')
      }
    } catch (err) {
      // If single() fails because no record is found, Supabase returns error. That's fine, go to signup
      setSignupForm({ name: '', username: '', dob: '', password: '' })
      setStep('signup_form')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignupSubmit(e) {
    e.preventDefault()
    if (!signupForm.name || !signupForm.username || !signupForm.dob || !signupForm.password) { 
      toast.error('Fill all fields')
      return 
    }
    if (signupForm.password.length < 4) {
      toast.error('Password must be at least 4 characters long')
      return
    }
    setLoading(true)
    try {
      // Check if username is already taken
      const { data: existingUser } = await supabase.from('customers').select('id').eq('username', signupForm.username.toLowerCase()).maybeSingle()
      if (existingUser) {
        toast.error('Username is already taken')
        return
      }

      const { data: newCust, error } = await supabase.from('customers').insert({
        name: signupForm.name,
        username: signupForm.username.toLowerCase(),
        mobile_number: mobile,
        dob: signupForm.dob,
        password_hash: signupForm.password,
        is_temp_password: false,
        ghoda_coins: 0,
        branch_id: null,
        registration_type: 'self'
      }).select().single()
      if (error) throw error
      setCustomer(newCust)
      toast.success('Welcome to Bombay Bethak!')
      navigate('/my-bethak/dashboard')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreatePasswordSubmit(e) {
    e.preventDefault()
    if (passwordInput.length < 4) {
      toast.error('Password must be at least 4 characters long')
      return
    }
    if (passwordInput !== confirmPasswordInput) {
      toast.error('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      const { data: updatedCust, error } = await supabase.from('customers')
        .update({
          password_hash: passwordInput,
          is_temp_password: false
        })
        .eq('id', tempCustomer.id)
        .select()
        .single()
      
      if (error) throw error
      setCustomer(updatedCust)
      toast.success(`Password set! Welcome, ${updatedCust.name}!`)
      navigate('/my-bethak/dashboard')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleEnterPasswordSubmit(e) {
    e.preventDefault()
    if (!passwordInput) {
      toast.error('Please enter your password')
      return
    }
    setLoading(true)
    try {
      // Re-fetch the customer to get the latest password_hash and is_temp_password
      const { data: freshCust, error } = await supabase.from('customers').select('*').eq('id', tempCustomer.id).single()
      if (error || !freshCust) {
        toast.error('Failed to authenticate. User not found.')
        return
      }

      if (freshCust.password_hash !== passwordInput) {
        toast.error('Incorrect password')
        return
      }

      if (freshCust.is_temp_password) {
        setTempCustomer(freshCust) // update with fresh data
        setPasswordInput('')
        setConfirmPasswordInput('')
        setStep('reset_temp_password')
      } else {
        setCustomer(freshCust)
        toast.success(`Welcome back, ${freshCust.name}!`)
        navigate('/my-bethak/dashboard')
      }
    } catch (err) {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function handleResetTempPasswordSubmit(e) {
    e.preventDefault()
    if (passwordInput.length < 4) {
      toast.error('Password must be at least 4 characters long')
      return
    }
    if (passwordInput !== confirmPasswordInput) {
      toast.error('Passwords do not match')
      return
    }
    if (passwordInput === tempCustomer.password_hash) {
      toast.error('New password cannot be the same as the temporary password')
      return
    }
    setLoading(true)
    try {
      const { data: updatedCust, error } = await supabase.from('customers')
        .update({
          password_hash: passwordInput,
          is_temp_password: false
        })
        .eq('id', tempCustomer.id)
        .select()
        .single()
      
      if (error) throw error
      setCustomer(updatedCust)
      toast.success('Password updated! Welcome back.')
      navigate('/my-bethak/dashboard')
    } catch (err) {
      toast.error(err.message)
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

        {step === 'signup_form' && (
          <motion.div key="signup_form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} style={STYLES.card}>
            <button onClick={() => setStep('mobile')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1.5rem', fontSize: '0.8rem', padding: 0 }}>
              <ArrowLeft size={14} /> Back
            </button>

            <form onSubmit={handleSignupSubmit}>
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
                        required
                        onChange={e => setSignupForm(p => ({ ...p, [f.key]: e.target.value }))}
                        onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.6)'}
                        onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
                      />
                    </div>
                  ))}
                  <div key="password">
                    <label style={STYLES.label}>Password</label>
                    <input
                      style={{ ...STYLES.input, fontSize: '0.9rem' }}
                      type="password" placeholder="••••••••" value={signupForm.password}
                      required minLength={4}
                      onChange={e => setSignupForm(p => ({ ...p, password: e.target.value }))}
                      onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.6)'}
                      onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
                    />
                  </div>
                </div>
              </div>

              <button type="submit" style={{ ...STYLES.btn, marginTop: '1.5rem' }} disabled={loading}>
                {loading ? 'Creating...' : 'Join Bombay Bethak'}
              </button>
            </form>
          </motion.div>
        )}

        {step === 'enter_password' && (
          <motion.div key="enter_password" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} style={STYLES.card}>
            <button onClick={() => { setStep('mobile'); setPasswordInput(''); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1.5rem', fontSize: '0.8rem', padding: 0 }}>
              <ArrowLeft size={14} /> Back
            </button>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: '1.4rem', color: 'white', marginBottom: '0.5rem', fontWeight: 700 }}>Enter Password</p>
            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.35)', marginBottom: '2rem' }}>Hello {tempCustomer?.name}, please enter your password.</p>
            
            <form onSubmit={handleEnterPasswordSubmit}>
              <label style={STYLES.label}>Password</label>
              <input
                style={STYLES.input}
                type="password" value={passwordInput} required
                onChange={e => setPasswordInput(e.target.value)}
                placeholder="••••••••"
                onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.6)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
                autoFocus
              />
              <button type="submit" style={{ ...STYLES.btn, marginTop: '1.5rem' }} disabled={loading}>
                {loading ? 'Verifying...' : <><span>Login</span><ArrowRight size={16} /></>}
              </button>
            </form>
          </motion.div>
        )}

        {step === 'create_password' && (
          <motion.div key="create_password" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} style={STYLES.card}>
            <button onClick={() => { setStep('mobile'); setPasswordInput(''); setConfirmPasswordInput(''); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1.5rem', fontSize: '0.8rem', padding: 0 }}>
              <ArrowLeft size={14} /> Back
            </button>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: '1.4rem', color: 'white', marginBottom: '0.5rem', fontWeight: 700 }}>Create Password</p>
            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.35)', marginBottom: '2rem' }}>For privacy, please set a password for your account.</p>
            
            <form onSubmit={handleCreatePasswordSubmit}>
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div>
                  <label style={STYLES.label}>New Password</label>
                  <input
                    style={STYLES.input}
                    type="password" value={passwordInput} required
                    onChange={e => setPasswordInput(e.target.value)}
                    placeholder="••••••••"
                    onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.6)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
                    autoFocus
                  />
                </div>
                <div>
                  <label style={STYLES.label}>Confirm Password</label>
                  <input
                    style={STYLES.input}
                    type="password" value={confirmPasswordInput} required
                    onChange={e => setConfirmPasswordInput(e.target.value)}
                    placeholder="••••••••"
                    onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.6)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
                  />
                </div>
              </div>
              <button type="submit" style={{ ...STYLES.btn, marginTop: '1.5rem' }} disabled={loading}>
                {loading ? 'Saving...' : 'Set Password & Login'}
              </button>
            </form>
          </motion.div>
        )}

        {step === 'reset_temp_password' && (
          <motion.div key="reset_temp_password" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} style={STYLES.card}>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: '1.4rem', color: 'white', marginBottom: '0.5rem', fontWeight: 700 }}>Reset Password</p>
            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.35)', marginBottom: '2rem' }}>You are logged in with a temporary password. You must set a new permanent password.</p>
            
            <form onSubmit={handleResetTempPasswordSubmit}>
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div>
                  <label style={STYLES.label}>New Password</label>
                  <input
                    style={STYLES.input}
                    type="password" value={passwordInput} required
                    onChange={e => setPasswordInput(e.target.value)}
                    placeholder="••••••••"
                    onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.6)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
                    autoFocus
                  />
                </div>
                <div>
                  <label style={STYLES.label}>Confirm New Password</label>
                  <input
                    style={STYLES.input}
                    type="password" value={confirmPasswordInput} required
                    onChange={e => setConfirmPasswordInput(e.target.value)}
                    placeholder="••••••••"
                    onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.6)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
                  />
                </div>
              </div>
              <button type="submit" style={{ ...STYLES.btn, marginTop: '1.5rem' }} disabled={loading}>
                {loading ? 'Updating...' : 'Update Password & Enter'}
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
