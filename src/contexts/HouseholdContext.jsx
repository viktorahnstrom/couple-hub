import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const HouseholdContext = createContext(null)

export function HouseholdProvider({ children }) {
  const { user } = useAuth()
  const [household, setHousehold] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setHousehold(null)
      setMembers([])
      setLoading(false)
      return
    }
    fetchHousehold()
  }, [user])

  async function fetchHousehold() {
    setLoading(true)
    try {
      const { data: membership } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', user.id)
        .single()

      if (!membership) {
        setLoading(false)
        return
      }

      const [{ data: hh }, { data: memberData }] = await Promise.all([
        supabase
          .from('households')
          .select('*')
          .eq('id', membership.household_id)
          .single(),
        supabase
          .from('household_members')
          .select('*, profiles(*)')
          .eq('household_id', membership.household_id)
      ])

      setHousehold(hh)
      setMembers(memberData || [])
    } catch (e) {
      console.error('fetchHousehold error:', e)
    } finally {
      setLoading(false)
    }
  }

  async function createHousehold(name) {
    const { data: hh, error } = await supabase
      .from('households')
      .insert({ name })
      .select()
      .single()
    if (error) return { error }

    const { error: memberError } = await supabase
      .from('household_members')
      .insert({ household_id: hh.id, user_id: user.id, role: 'owner' })
    if (memberError) return { error: memberError }

    await fetchHousehold()
    return { data: hh }
  }

  async function joinHousehold(inviteCode) {
    const { data: hh, error } = await supabase
      .from('households')
      .select('*')
      .eq('invite_code', inviteCode.toUpperCase().trim())
      .single()

    if (error || !hh) return { error: { message: 'Ogiltig inbjudningskod' } }

    const { error: memberError } = await supabase
      .from('household_members')
      .insert({ household_id: hh.id, user_id: user.id, role: 'member' })
    if (memberError) return { error: memberError }

    await fetchHousehold()
    return { data: hh }
  }

  return (
    <HouseholdContext.Provider value={{
      household,
      members,
      loading,
      createHousehold,
      joinHousehold,
      refetch: fetchHousehold
    }}>
      {children}
    </HouseholdContext.Provider>
  )
}

export const useHousehold = () => useContext(HouseholdContext)
