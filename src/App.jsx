// App.jsx — 온보딩 여부 분기 + 탭 화면 전환
import { useEffect, useState } from 'react'
import { FeedbackProvider } from './components/Feedback.jsx'
import TabBar from './components/TabBar.jsx'
import Onboarding from './screens/Onboarding.jsx'
import Home from './screens/Home.jsx'
import Meals from './screens/Meals.jsx'
import Exercise from './screens/Exercise.jsx'
import Settings from './screens/Settings.jsx'
import { getProfile, saveProfile } from './lib/db.js'

function AppShell() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [screen, setScreen] = useState('home')
  const [exerciseFullscreen, setExerciseFullscreen] = useState(false)

  useEffect(() => {
    getProfile().then((p) => { setProfile(p || null); setLoading(false) })
  }, [])

  async function handleOnboardingComplete(newProfile) {
    await saveProfile(newProfile)
    setProfile(newProfile)
  }

  async function handleSettingsSave(newProfile) {
    await saveProfile(newProfile)
    setProfile(newProfile)
  }

  async function updateProfile(partial) {
    const next = { ...profile, ...partial }
    await saveProfile(next)
    setProfile(next)
    return next
  }

  if (loading) return null
  if (!profile) return <Onboarding onComplete={handleOnboardingComplete} />

  const showTabBar = screen !== 'settings' && !(screen === 'exercise' && exerciseFullscreen)

  return (
    <>
      {screen === 'home' && <Home profile={profile} onOpenSettings={() => setScreen('settings')} onOpenExercise={() => setScreen('exercise')} onUpdateProfile={updateProfile} />}
      {screen === 'meals' && <Meals profile={profile} onUpdateProfile={updateProfile} />}
      {screen === 'exercise' && (
        <Exercise profile={profile} onFullscreenChange={setExerciseFullscreen} onUpdateProfile={updateProfile} />
      )}
      {screen === 'settings' && (
        <Settings profile={profile} onSave={handleSettingsSave} onUpdateProfile={updateProfile} onBack={() => setScreen('home')} />
      )}
      {showTabBar && <TabBar active={screen} onNavigate={setScreen} />}
    </>
  )
}

export default function App() {
  return (
    <div className="phone">
      <FeedbackProvider>
        <AppShell />
      </FeedbackProvider>
    </div>
  )
}
